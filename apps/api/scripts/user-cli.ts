#!/usr/bin/env node
// 用户管理 CLI（受邀制建号入口，需先 pnpm migration:run）。
// 运行方式（从 apps/api 目录）：
//   pnpm user:add <username> [password]            # 建号，用户名重复报错
//   pnpm user:reset-password <username> [password] # 重置密码（吊销该用户全部会话）
//   pnpm user:seed <username> [password]           # 仅当 users 表为空时创建首账号
// password 省略时自动生成 16 位随机密码，仅打印一次。
import '../src/config';

import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/data-source';
import { UserEntity } from '../src/users/entities/user.entity';
import {
  hashPassword,
  validatePassword,
  validateUsername,
} from '../src/users/password';

const USAGE = `用法：
  pnpm user:add <username> [password]
  pnpm user:reset-password <username> [password]
  pnpm user:seed <username> [password]`;

const fail = (msg: string): never => {
  console.error('[FAIL]', msg);
  process.exit(1);
};
// PG unique_violation（23505）：用户名已存在。
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && e.code === '23505'
  );
}

// 省略密码时生成 16 位随机密码（base64url，无易混淆字符）。
function resolvePassword(password: string | undefined): {
  password: string;
  generated: boolean;
} {
  if (password) return { password, generated: false };
  return { password: randomBytes(12).toString('base64url'), generated: true };
}

async function main(): Promise<void> {
  const [cmd, username, passwordArg] = process.argv.slice(2);
  if (!cmd || !username || !['add', 'reset-password', 'seed'].includes(cmd)) {
    fail(USAGE);
  }

  const usernameError = validateUsername(username);
  if (usernameError) fail(usernameError);
  const { password, generated } = resolvePassword(passwordArg);
  const passwordError = validatePassword(password);
  if (passwordError) fail(passwordError);

  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  const repo = dataSource.getRepository(UserEntity);

  try {
    if (cmd === 'seed') {
      const count = await repo.count();
      if (count > 0) {
        console.log(`[SKIP] users 表已有 ${count} 个用户，seed 不做任何改动`);
        return;
      }
    }

    const action = cmd === 'add' || cmd === 'seed' ? '创建' : '重置密码';

    if (cmd === 'add' || cmd === 'seed') {
      try {
        await repo.insert({
          id: randomUUID(),
          username,
          passwordHash: await hashPassword(password),
          tokenVersion: 0,
        });
      } catch (e) {
        if (isUniqueViolation(e)) fail(`用户名已存在：${username}`);
        throw e;
      }
    } else {
      // reset-password：tokenVersion +1，该用户全部旧 token 立即失效。
      const result = await repo.update(
        { username },
        {
          passwordHash: await hashPassword(password),
          tokenVersion: () => 'token_version + 1',
        },
      );
      if (!result.affected) fail(`用户不存在：${username}`);
    }

    console.log(`[OK] 已${action}用户 ${username}`);
    if (generated) console.log(`密码（仅显示一次）：${password}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error('[USER-CLI ERROR]', e);
  process.exit(1);
});

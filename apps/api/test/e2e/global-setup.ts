// vitest globalSetup（主进程，整轮测试执行一次）：
// 1) 重建测试库——DROP ... WITH (FORCE) 掐掉上一轮遗留连接后 CREATE，每轮从空库
//    开始，migration 全量重放，不依赖上一轮跑过什么。
// 2) 跑全部 migration，应用与测试共用同一套 schema 产出。
import 'reflect-metadata'; // 实体装饰器在 import 期写元数据，须先装上 shim
import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/data-source';
import { CreateDocuments1788090000000 } from '../../src/database/migrations/1788090000000-CreateDocuments';
import { AddDeletedAt1788331342758 } from '../../src/database/migrations/1788331342758-AddDeletedAt';
import { CreateUsers1788350000000 } from '../../src/database/migrations/1788350000000-CreateUsers';
import { pgSsl } from './fixtures';

// 迁移类显式注册（顺序 = 文件名时间戳序）：TypeORM 运行时按路径加载 .ts 迁移
// 在 vitest 下不可行；与 data-source 显式注册实体的哲学一致，新增 migration 时
// 在此追加一行。
const MIGRATIONS = [
  CreateDocuments1788090000000,
  AddDeletedAt1788331342758,
  CreateUsers1788350000000,
];

// 注册对账：新增 migration 忘记注册时，schema 缺列只会表现为遥远的用例失败；
// 跑库前先对账磁盘文件数，让遗漏当场炸出。
const MIGRATIONS_DIR = path.resolve(__dirname, '../../src/database/migrations');
const migrationFileCount = readdirSync(MIGRATIONS_DIR).filter((f) =>
  f.endsWith('.ts'),
).length;
if (migrationFileCount !== MIGRATIONS.length) {
  throw new Error(
    `migration 注册与磁盘文件数不一致（注册 ${MIGRATIONS.length} / 文件 ${migrationFileCount}）：` +
      '请在 test/e2e/global-setup.ts 的 MIGRATIONS 数组追加新迁移类',
  );
}

export default async function globalSetup(): Promise<void> {
  // 与 src/config.ts 同样的定位方式：pnpm 脚本 CWD 为 apps/api。
  const rootEnv = path.resolve(process.cwd(), '..', '..', '.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL 未配置：请在仓库根 .env 指向 e2e 测试库（库名以 _test 结尾）',
    );
  }
  const databaseName = databaseNameOf(testUrl);
  if (!/_test$/.test(databaseName)) {
    throw new Error(
      `TEST_DATABASE_URL 库名必须以 _test 结尾（当前：${databaseName}）：` +
        '本套件每轮 DROP/CREATE 该库，后缀护栏防止误删开发/生产库',
    );
  }

  await recreateDatabase(testUrl, databaseName);

  // DATABASE_URL 顶替为测试库后，复用应用的 DataSource 选项（ssl/logging 等配置同源）。
  process.env.DATABASE_URL = testUrl;
  const dataSource = new DataSource({
    ...buildDataSourceOptions(),
    migrations: MIGRATIONS,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

async function recreateDatabase(
  testUrl: string,
  databaseName: string,
): Promise<void> {
  // 连维护库 postgres 执行 DROP/CREATE；WITH (FORCE) 需 PG ≥ 13（当前 16）。
  const admin = new URL(testUrl);
  admin.pathname = '/postgres';
  const client = new Client({
    connectionString: admin.toString(),
    // PG_SSL 语义与应用侧 buildDataSourceOptions 一致：要求 SSL 的远程库两侧行为同步
    ssl: pgSsl(),
  });
  await client.connect();
  try {
    const ident = `"${databaseName.replaceAll('"', '""')}"`;
    await client.query(`DROP DATABASE IF EXISTS ${ident} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${ident}`);
  } finally {
    await client.end();
  }
}

function databaseNameOf(url: string): string {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name) throw new Error(`TEST_DATABASE_URL 缺少库名：${url}`);
  return name;
}

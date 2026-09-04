// e2e 公共夹具：进程内 Nest 应用生命周期 + 测试库数据重置 + 受测账号登录。
// 边界约定（issue #2）：只通过 HTTP 驱动被测系统、用夹具 SQL 播种数据，
// 不 import 内部 service/repository——断言全部落在 HTTP 响应与可观察行为上。
import 'reflect-metadata'; // 装饰器元数据须先于 AppModule 的类定义就绪
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcryptjs';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TEST_USER, pgSsl } from './fixtures';

let app: INestApplication | null = null;
let pg: Client | null = null;

// Nest 把 getHttpServer 的返回声明为 any：这里经 unknown 收敛后断言为
// http.Server（supertest 驱动目标），是本套件唯一的类型收窄点。
function httpServer(): Server {
  if (!app) throw new Error('应用未启动：先在 beforeAll 调用 startApp()');
  const server: unknown = app.getHttpServer();
  return server as Server;
}

// beforeAll：起进程内应用（不监听端口，supertest 直连底层 http server）。
export async function startApp(): Promise<Server> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  return httpServer();
}

// afterAll：app.close() 释放 TypeORM 连接池；夹具 pg 连接一并关闭。
// 两资源独立：close 抛错也不能漏掉 pg 连接，用 finally 兜底。
export async function stopApp(): Promise<void> {
  try {
    await app?.close();
  } finally {
    app = null;
    await pg?.end();
    pg = null;
  }
}

// beforeEach：清空业务表并重新播种受测账号，用例间互不串数据。
// 哈希只算一次复用（bcryptjs，轮数与 src/users/password 一致；校验只看哈希内嵌参数）。
const TEST_USER_ID = randomUUID();
const TEST_USER_PASSWORD_HASH = hashSync(TEST_USER.password, 10);

export async function resetData(): Promise<void> {
  if (!pg) {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
      throw new Error('TEST_DATABASE_URL 未配置（见 test/e2e/setup-env.ts）');
    }
    // PG_SSL 语义与应用侧一致（fixtures.pgSsl），远程库要求 SSL 时两侧行为同步
    pg = new Client({ connectionString: url, ssl: pgSsl() });
    try {
      await pg.connect();
    } catch (err) {
      pg = null;
      throw new Error(
        `无法连接测试库，请检查 TEST_DATABASE_URL（${url}）：${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  await pg.query('TRUNCATE TABLE documents, users');
  await pg.query(
    'INSERT INTO users (id, username, password_hash, token_version) VALUES ($1, $2, $3, 0)',
    [TEST_USER_ID, TEST_USER.username, TEST_USER_PASSWORD_HASH],
  );
}

// 走公开登录端点换取 token（不自行签发 JWT——那是内部实现细节）。
export async function getAccessToken(): Promise<string> {
  const res = await request(httpServer())
    .post('/auth/login')
    .send({ username: TEST_USER.username, password: TEST_USER.password });
  // 响应体是外部输入：守卫式取出 access_token，形状意外时给出可读报错。
  const body: unknown = res.body;
  if (
    res.status !== 200 ||
    !body ||
    typeof body !== 'object' ||
    !('access_token' in body) ||
    typeof body.access_token !== 'string'
  ) {
    throw new Error(`夹具登录失败 ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return body.access_token;
}

// 鉴权契约钉住（issue #2）：全部受保护端点未带 token 一律 401（数据安全不因
// 后续摄取改造回退），登录端点公开且失败语义明确。
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import type { AuthUserDto, LoginResponse } from '@kh/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_USER, UUID_RE } from './fixtures';
import { resetData, startApp, stopApp } from './harness';

// 受保护端点全集（新端点受保护时在此登记）。
const PROTECTED_ENDPOINTS: [string, (server: Server) => request.Test][] = [
  ['POST /documents', (server) => request(server).post('/documents')],
  ['GET /documents', (server) => request(server).get('/documents')],
  [
    'DELETE /documents/:id',
    (server) => request(server).delete(`/documents/${randomUUID()}`),
  ],
  ['GET /auth/me', (server) => request(server).get('/auth/me')],
  [
    'POST /auth/change-password',
    (server) =>
      request(server)
        .post('/auth/change-password')
        .send({ old_password: 'whatever-1', new_password: 'whatever-2' }),
  ],
];

// 响应体 cast 说明：断言即校验——cast 到契约形状只为逐字段断言服务，
// 形状不符时下方断言立即失败，不存在静默读错。

describe('鉴权契约', () => {
  let server: Server;

  beforeAll(async () => {
    server = await startApp();
  });
  afterAll(async () => {
    await stopApp();
  });
  beforeEach(async () => {
    await resetData();
  });

  describe('受保护端点', () => {
    it.each(PROTECTED_ENDPOINTS)(
      '%s 未带 token → 401',
      async (_name, makeRequest) => {
        const res = await makeRequest(server);
        expect(res.status).toBe(401);
      },
    );

    it('携带无效 token → 401', async () => {
      const res = await request(server)
        .get('/documents')
        .set('Authorization', 'Bearer not-a-jwt');

      expect(res.status).toBe(401);
    });

    it('非 Bearer 的 Authorization 头 → 401', async () => {
      const res = await request(server)
        .get('/documents')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
    });

    it('带有效 token → 200 放行', async () => {
      const login = await request(server).post('/auth/login').send({
        username: TEST_USER.username,
        password: TEST_USER.password,
      });
      const loginBody = login.body as LoginResponse;

      const res = await request(server)
        .get('/documents')
        .set('Authorization', `Bearer ${loginBody.access_token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('登录端点（公开）', () => {
    it('密码错误 → 401', async () => {
      const res = await request(server).post('/auth/login').send({
        username: TEST_USER.username,
        password: 'wrong-password',
      });

      expect(res.status).toBe(401);
    });

    it('用户不存在 → 401（与密码错误同类拒绝，不泄漏账号存在性）', async () => {
      const res = await request(server).post('/auth/login').send({
        username: 'no_such_user',
        password: TEST_USER.password,
      });

      expect(res.status).toBe(401);
    });

    it('缺 username / password 字段 → 400', async () => {
      const res = await request(server).post('/auth/login').send({});

      expect(res.status).toBe(400);
    });

    it('登录成功 → 200，形状 access_token + user', async () => {
      const res = await request(server).post('/auth/login').send({
        username: TEST_USER.username,
        password: TEST_USER.password,
      });

      expect(res.status).toBe(200);
      const body = res.body as LoginResponse;
      expect(Object.keys(body).sort()).toEqual(['access_token', 'user']);
      expect(typeof body.access_token).toBe('string');
      expect(body.access_token.length).toBeGreaterThan(0);
      expect(Object.keys(body.user).sort()).toEqual(['id', 'username']);
      expect(body.user.id).toMatch(UUID_RE);
      expect(body.user.username).toBe(TEST_USER.username);
    });

    it('GET /auth/me 带 token → 200 返回当前用户', async () => {
      const login = await request(server).post('/auth/login').send({
        username: TEST_USER.username,
        password: TEST_USER.password,
      });
      const loginBody = login.body as LoginResponse;

      const res = await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${loginBody.access_token}`);

      expect(res.status).toBe(200);
      const body = res.body as AuthUserDto;
      expect(Object.keys(body).sort()).toEqual(['id', 'username']);
      expect(body.id).toMatch(UUID_RE);
      expect(body.username).toBe(TEST_USER.username);
    });
  });
});

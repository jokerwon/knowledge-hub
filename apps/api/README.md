# knowledge-hub API

NestJS + TypeORM + PostgreSQL 文档摄取服务。

```bash
cp ../../.env.example ../../.env   # DATABASE_URL / TEST_DATABASE_URL / UPLOAD_MAX_BYTES / JWT_SECRET
pnpm migration:run && pnpm dev     # http://localhost:8001
```

依赖服务使用已就绪的远程 PostgreSQL（`.env` 的 `DATABASE_URL`），不在本地跑 Docker；`deploy/docker-compose.yml` 仅供服务器部署参考。

端点：`POST /documents`（multipart `file`，.md/.txt ≤2 MiB，同步摄取）、`GET /documents`、`DELETE /documents/:id`。
以上端点与 `GET /auth/me`、`POST /auth/change-password` 均需 `Authorization: Bearer <token>`；`POST /auth/login` 公开。

## 测试（e2e 契约）

```bash
pnpm test   # 仓库根一条命令；等价于在 apps/api 下 pnpm test
```

vitest + supertest 驱动进程内 Nest 应用，连接 `TEST_DATABASE_URL` 指定的真实 PG 测试库
（库名必须以 `_test` 结尾）：每轮自动 DROP/CREATE 测试库并重跑全部 migration，
用例间 truncate + 重新播种测试账号。现有 HTTP 契约（md/txt 上传 200 即 ready、
列表、删除、未带 token 401、超限/扩展名违规 400）钉住在 `test/e2e/*.e2e-spec.ts`，
契约变更必须显式更新对应断言。

DB 冒烟：`TS_NODE_PROJECT=tsconfig.cli.json node --require ts-node/register scripts/smoke-db.ts`。

## 用户管理（受邀制，不开放注册）

所有文档数据登录后共享。JWT 有效期 7 天；改密后该用户全部旧会话即时失效（token_version 机制），当前会话由 web 侧换发新 token 保持在线。

```bash
pnpm user:seed <username> [password]            # 首次初始化（仅 users 表为空时创建）
pnpm user:add <username> [password]             # 建号；password 省略则生成随机密码并打印一次
pnpm user:reset-password <username> [password]  # 重置密码（吊销该用户全部会话）
```

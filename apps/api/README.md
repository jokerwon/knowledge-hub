# knowledge-hub API

NestJS + TypeORM + PostgreSQL 文档摄取服务。

```bash
cp ../../.env.example ../../.env   # DATABASE_URL / UPLOAD_MAX_BYTES / JWT_SECRET
docker compose -f ../../deploy/docker-compose.yml up -d
pnpm migration:run && pnpm dev     # http://localhost:8001
```

端点：`POST /documents`（multipart `file`，.md/.txt ≤2 MiB，同步摄取）、`GET /documents`、`DELETE /documents/:id`。
以上端点与 `GET /auth/me`、`POST /auth/change-password` 均需 `Authorization: Bearer <token>`；`POST /auth/login` 公开。
DB 冒烟：`TS_NODE_PROJECT=tsconfig.cli.json node --require ts-node/register scripts/smoke-db.ts`。

## 用户管理（受邀制，不开放注册）

所有文档数据登录后共享。JWT 有效期 7 天；改密后该用户全部旧会话即时失效（token_version 机制），当前会话由 web 侧换发新 token 保持在线。

```bash
pnpm user:seed <username> [password]            # 首次初始化（仅 users 表为空时创建）
pnpm user:add <username> [password]             # 建号；password 省略则生成随机密码并打印一次
pnpm user:reset-password <username> [password]  # 重置密码（吊销该用户全部会话）
```

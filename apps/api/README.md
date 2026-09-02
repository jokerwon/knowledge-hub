# knowledge-hub API

NestJS + TypeORM + PostgreSQL 文档摄取服务。

```bash
cp ../../.env.example ../../.env   # DATABASE_URL / UPLOAD_MAX_BYTES
docker compose -f ../../deploy/docker-compose.yml up -d
pnpm migration:run && pnpm dev     # http://localhost:8001
```

端点：`POST /documents`（multipart `file`，.md/.txt ≤2 MiB，同步摄取）、`GET /documents`、`DELETE /documents/:id`。
DB 冒烟：`TS_NODE_PROJECT=tsconfig.cli.json node --require ts-node/register scripts/smoke-db.ts`。

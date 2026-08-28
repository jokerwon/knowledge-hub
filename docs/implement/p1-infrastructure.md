# P1：基础设施（可执行计划）

| 项 | 内容 |
| --- | --- |
| 预估 | 3h |
| 前置 | P0 完成 |
| 被依赖 | P3（数据库连接）、P7-4 验收第 1 项 |
| 相关决策 | ADR-0017、ADR-0003、ADR-0005 |

## 目标

`deploy/docker-compose.yml` 一条命令拉起且仅拉起两个基础设施服务：PostgreSQL（含 pgvector）与 MongoDB。应用永远宿主机运行，不写 Dockerfile。

## 步骤

### 1. postgres 服务（P1-1，1h）

- `deploy/docker-compose.yml` 增加 postgres：
  - 镜像 `pgvector/pgvector:pg16`（或等价含 pgvector 的镜像）；
  - 环境变量 `POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB`；
  - 命名卷持久化；端口映射 5432（可经环境变量覆盖）；
  - healthcheck：`pg_isready`。
- 验证：`docker compose up -d postgres` 后 `psql` 连通，`CREATE EXTENSION vector;` 执行成功。

### 2. mongo 服务（P1-2，0.5h）

- 同文件增加 `mongo:7`：命名卷、端口 27017、healthcheck（`mongosh --eval "db.adminCommand('ping')"`）。
- 验证：`mongosh` 连通。

### 3. 连接串模板（P1-3，0.5h）

- `.env.example` 补齐：
  ```
  DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/knowledge_hub
  MONGO_URL=mongodb://localhost:27017/knowledge_hub
  ```

### 4. 全新环境演练（P1-4，1h）

- `docker compose down -v && docker compose up -d`，等待两服务 healthy。
- 依次验证 psql、mongosh 连通与 vector 扩展可用。

## 完成标准

- [ ] `docker compose up -d` 后两库均 healthy
- [ ] 两个连接串可直连
- [ ] 无任何应用服务的 Dockerfile / compose 条目

## 备注

- `CREATE EXTENSION vector` 的正式启用放在 P3 首个 migration 内，compose 不写 init 脚本，保证"全新卷 + migration"即可用。

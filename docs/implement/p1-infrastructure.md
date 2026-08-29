# P1：基础设施（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | 🟡 编写完成，运行时验证（P1-4）延后——本机无 Docker 环境 |
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

- [ ] `docker compose up -d` 后两库均 healthy（待 P1-4 补验）
- [ ] 两个连接串可直连（待 P1-4 补验）
- [x] 无任何应用服务的 Dockerfile / compose 条目（静态检查已确认：全仓无 Dockerfile，compose 仅数据服务）

> P1-4 为 P3 开工前的硬性前置：拿到可用 Docker 环境后先补验本节，再开始数据层。

## 备注

- `CREATE EXTENSION vector` 的正式启用放在 P3 首个 migration 内，compose 不写 init 脚本，保证"全新卷 + migration"即可用。

## 实施记录

### 已执行（2026-08-28）

- P1-1：新建 `deploy/docker-compose.yml`，postgres 服务镜像 `pgvector/pgvector:pg16`，healthcheck 用 `pg_isready`。
- P1-2：同文件 mongo 服务镜像 `mongo:7`，healthcheck 用 `mongosh --eval db.adminCommand('ping')`。
- P1-3：根 `.env.example` 补齐 `DATABASE_URL` / `MONGO_URL` 连接串模板（与 compose 凭据一致）。
- P1-4 未执行：本机 Docker daemon 未运行，按用户指示不在本地执行 Docker；两库 healthy、`psql`/`mongosh` 连通、`CREATE EXTENSION vector` 验证延后到有 Docker 环境时进行（P3 首个 migration 前必须补验）。compose 文件仅做静态编写，未经实际拉起验证。

### 用户手动改写 compose 后的偏差（2026-08-28）

用户对 `deploy/docker-compose.yml` 做了整体改写，最终态与计划的差异记录如下（以仓库当前文件为准）：

- 数据持久化由命名卷改为 bind mount：`${DOCKER_VOLUME_DIRECTORY:-.}/volumes/{postgres,mongo}`（可整体外迁数据目录）；`deploy/volumes/` 已加入根 .gitignore。
- mongo 启用认证（`MONGO_INITDB_ROOT_USERNAME/PASSWORD`），服务名改为 `mongodb`，镜像钉为 `mongo:7-jammy`，healthcheck 带 `-u/-p --authenticationDatabase admin`；`MONGO_URL` 模板相应改为 `mongodb://mongo_user:mongo_pass123@localhost:27017/knowledge_hub?authSource=admin`。
- 新增第三个服务 mongo-express（Web GUI，8081 端口，独立网页登录账号，depends_on 等待 mongodb healthy）。计划"仅拉起两个基础设施服务"的口径放宽为"两个数据服务 + 一个可选管理工具"；验收时如需严格两服务可单独 `up -d postgres mongodb`。
- 两库均挂载 `./init-scripts/{postgresql,mongodb}` 初始化脚本目录。备注中"compose 不写 init 脚本"的约束不变——目录当前为空、仅占位，`CREATE EXTENSION vector` 仍放 P3 首个 migration，不依赖 init 脚本。
- 各服务加 `container_name`（knowledge_hub_*）与 `restart: always`；显式声明 default 网络名 `common-network`。
- 修正：手动版 pg healthcheck 原写成 `-d hello_pg`（与 `POSTGRES_DB=knowledge_hub` 不符），已改回 `knowledge_hub`。

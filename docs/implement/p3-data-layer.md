# P3：数据层（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | ✅ 已完成（2026-08-30，提交 eb31f5e，见实施记录） |
| 预估 | 7h |
| 前置 | P0（api 骨架）、P1（两库可连）；开放项 2（embed 模型与维度）须在步骤 3 前拍板 |
| 被依赖 | P4、P5 |
| 相关决策 | ADR-0016、ADR-0005、ADR-0013、ADR-0002 |

## 目标

双库数据访问就绪：TypeORM（PG，migration 管理、禁 synchronize）+ Mongoose（Mongo，仅 `document_contents`）；pgvector 列可用、HNSW 索引就位。

建议源码布局（api 内）：

```
apps/api/src/database/   # TypeORM/Mongoose 接线、entities、migrations
```

## 步骤

### 1. TypeORM 接入（P3-1，1h）

- `@nestjs/typeorm` + `pg`；DataSource 读 `DATABASE_URL`。
- **显式 `synchronize: false`**；指定 migrations 目录与 entities。
- 验证：api 启动连库成功；全局 `grep -r "synchronize" apps/api/src` 无 `true`。

### 2. migration 工具链（P3-2，0.5h）

- `apps/api` scripts：`migration:generate` / `migration:run` / `migration:revert`（TypeORM CLI + ts-node，根侧 `pnpm --filter api` 代理）。
- 验证：空迁移可生成、可执行、可回退。

### 3. 迁移：documents 表（P3-3，1h）

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE documents (
  id          uuid PRIMARY KEY,                    -- 应用层生成（ADR-0013）
  title       text NOT NULL,
  status      text NOT NULL CHECK (status IN ('ready','failed')),
  user_id     uuid NULL,                           -- 预留（ADR-0002）
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### 4. 迁移：chunks 表 + 索引（P3-4，1h）

```sql
CREATE TABLE chunks (
  id          uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  seq         int  NOT NULL,
  content     text NOT NULL,
  embedding   vector(<dim>) NOT NULL               -- dim 按拍板的 embed 模型锁死
);
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
```

- 注意：日后换维度需新迁移 + 删除重传文档，不回溯重建（ADR-0012 后果）。

### 5. pgvector 列类型 + 实体（P3-5，2h）★ 最硬骨头

- 用社区惯用做法自定义 `vector` 列类型（ValueTransformer / 自定义 column type），实体侧 `embedding: number[]`。
- 实体：`DocumentEntity`、`ChunkEntity`（关系、级联）。
- **首日先做最小验证**：建表 → 插入含向量行 → `<=>` 查询，通了再写业务。

### 6. Mongoose 接入（P3-6，1h）

- `@nestjs/mongoose`，连接读 `MONGO_URL`。
- `document_contents` schema：`{ document_id: string（唯一索引）, content: string }`；仅此一个集合。

### 7. 双库冒烟（P3-7，0.5h）

- migration up/down 往返一次；手工插入含向量的行，验证 `ORDER BY embedding <=> $1` 排序正确。

## 完成标准

- [x] migrations 可 up/down，表结构与 design.md §4 一致
- [x] 向量插入与余弦查询可用，HNSW 索引存在
- [x] `document_contents` 唯一索引生效
- [x] 无任何 `synchronize: true`

## 坑位备忘

- TypeORM 对 `vector` 类型无原生支持，自定义列类型的序列化格式（`[0.1,0.2,...]` 字符串）是常见坑，冒烟先行。
- HNSW 建索引在大表上慢，本量级无感，但迁移脚本需幂等（`IF NOT EXISTS`）。

## 实施记录

### 已执行（2026-08-30）

- **P3-1 TypeORM 接入**：新增 `@nestjs/typeorm`、`typeorm`、`pg`、`dotenv`；`apps/api/src/database/data-source.ts` 提供 `buildDataSourceOptions()`，从 monorepo 根 `.env` 读 `DATABASE_URL`（`path.resolve(process.cwd(), '..', '..', '.env')`，因 pnpm 脚本的 CWD 为 `apps/api`）；显式 `synchronize: false`、`migrationsRun: false`；`database.module.ts` 以 `TypeOrmModule.forRoot(...)` 注册。
- **P3-2 migration 工具链**：`apps/api/package.json` 增加 `typeorm` / `migration:generate` / `migration:run` / `migration:revert` / `migration:show` 脚本，用 `cross-env` 跨平台注入 `TS_NODE_PROJECT=tsconfig.cli.json`；新增 `tsconfig.cli.json` 以 `module: commonjs` + `moduleResolution: node` 专门服务 TypeORM CLI（与 `tsconfig.build.json` 的 `module: nodenext` 解耦）；`tsconfig.build.json` 排除 `ormconfig.ts` 避免 TS6059。
- **P3-3 documents 迁移**：`migrations/1788090000000-CreateDocuments.ts` 先 `CREATE EXTENSION IF NOT EXISTS vector`，再建 `documents`（uuid PK、status `CHECK (status IN ('ready','failed'))`、`user_id` 预留、`created_at timestamptz DEFAULT now()`）。
- **P3-4 chunks 迁移**：`migrations/1788090000100-CreateChunks.ts` 建 `chunks`（FK `chunks_document_id_fkey` 级联删除）并用 `CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops)`；维度读 `EMBEDDING_DIM`（默认 768）。
- **P3-5 pgvector 列类型与实体**：`vector-transformer.ts` 提供 `ValueTransformer`（`to` 序列化为 `[0.1,0.2,...]`、`from` 反序列化）与 `EMBEDDING_DIM`；`DocumentEntity` 用 `@Check('documents_status_check', ...)` 装饰器对齐 CHECK 约束；`ChunkEntity` 用 `length: EMBEDDING_DIM` 的 `vector` 列 + `@ManyToOne` 配 `foreignKeyConstraintName`，消除 `migration:generate` 的漂移。HNSW 索引由迁移管理（TypeORM 1.1 不支持 `using: hnsw` / operator class），生成迁移时需人工剔除 `DROP INDEX chunks_embedding_hnsw_idx`。
- **P3-6 Mongoose 接入**：新增 `@nestjs/mongoose`、`mongoose`；`DatabaseModule` 同时 `MongooseModule.forRoot(MONGO_URL)`；`schemas/document-content.schema.ts` 用 `@nestjs/mongoose` 装饰器声明 `document_contents`（`document_id` 唯一索引、`versionKey: false`），并通过 `export type` 规避 `isolatedModules` 的 TS1205。
- **P3-7 双库冒烟**：新增 `apps/api/scripts/smoke-db.ts`，脚本顶部自行 `dotenv.config({ path: monorepo-root/.env })`（不用 `--require dotenv/config`，因后者按 CWD 查找会落空）。`migration:show` 两条均为 `[X]`；冒烟实测见下。

### P3-7 冒烟结果（全部 PASS）

| # | 检查项 | 结果 |
| --- | --- | --- |
| 1 | `CreateDocuments` / `CreateChunks` migration 已应用 | ✅ |
| 2 | `documents` 与 `chunks` 表存在 | ✅ |
| 3 | pgvector 扩展已装（v0.8.6） | ✅ |
| 4 | `chunks_embedding_hnsw_idx` 存在，算法 hnsw + `vector_cosine_ops` | ✅ |
| 5 | 三条向量插入后 `ORDER BY embedding <=> $1::vector` 排序正确（seq=0 最近） | ✅ |
| 6 | `EXPLAIN` 命中索引（HNSW / Index Scan） | ✅ |
| 7 | Mongoose `document_contents` 唯一索引生效（重复 `document_id` 抛错） | ✅ |
| 8 | `content` 可读取 | ✅ |

### 已知限制 / 遗留

- TypeORM 不支持 HNSW/operator class 声明式索引，实体不写 `@Index`，由迁移独占；日后 `migration:generate` 若感知到"应有索引"会输出 `DROP INDEX`，需人工剔除。
- 切换向量维度需新迁移 + 重传文档（ADR-0012 后果），本期未实现回滚工具。
- `MONGO_URL` 与 `DATABASE_URL` 的 `.env` 必须由 monorepo 根加载；脚本统一使用 `path.resolve(process.cwd(), '..', '..', '.env')`。

### 提交

- `eb31f5e` `feat(api): P3 数据层——TypeORM/Mongoose 双库接入、documents/chunks 迁移与 HNSW 索引、pgvector 列类型与冒烟脚本`（20 files, +977/−10）
- 本条 `docs(implement): P3 数据层标记完成` 紧随落地（仅本文档）

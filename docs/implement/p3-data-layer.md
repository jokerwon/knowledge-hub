# P3：数据层（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | ⬜ 未开始（开工前先补 P1-4 运行时验证；开放项 2 未拍板） |
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

- [ ] migrations 可 up/down，表结构与 design.md §4 一致
- [ ] 向量插入与余弦查询可用，HNSW 索引存在
- [ ] `document_contents` 唯一索引生效
- [ ] 无任何 `synchronize: true`

## 坑位备忘

- TypeORM 对 `vector` 类型无原生支持，自定义列类型的序列化格式（`[0.1,0.2,...]` 字符串）是常见坑，冒烟先行。
- HNSW 建索引在大表上慢，本量级无感，但迁移脚本需幂等（`IF NOT EXISTS`）。

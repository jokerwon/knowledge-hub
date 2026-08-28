# ADR-0016：数据访问层——TypeORM（PG） + Mongoose（Mongo）

- 状态：已接受
- 日期：2026-08-28

## 背景

双库边界（ADR-0005）需要 PG 与 Mongo 各自的数据访问方案，可选 TypeORM+Mongoose、Prisma 双管、Drizzle+原生驱动。

## 决策

- PG 使用 **TypeORM**（NestJS 生态最成熟）；pgvector 的 `vector` 列采用社区现成做法自定义列类型，相似度查询用原生 SQL 片段。
- Mongo 使用 **Mongoose**，仅承载 `document_contents` 一个集合。
- 数据库 schema 以迁移文件为准（TypeORM migrations），禁止 `synchronize: true`。

## 后果

- 两库均为 NestJS 一等公民，模块集成样板最少。
- Prisma 双管虽 DX 统一，但 pgvector 依赖 raw SQL 丢失类型安全，故弃用；Drizzle 需自建 NestJS 封装，MVP 不划算。

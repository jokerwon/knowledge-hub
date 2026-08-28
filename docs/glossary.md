# 术语表（Glossary）

本表只收录**已在拷问会话中核实**的术语，随决策轮次持续追加。

| 术语 | 定义 | 来源 |
| --- | --- | --- |
| 核心闭环 | MVP 唯一必须保留的用户任务：上传文档 → 向量化 → 基于文档的多轮问答（带引用）。文档管理仅含最小必要能力（列表/删除） | ADR-0001 |
| 文档（Document） | 用户上传的原始文件及其元数据。MVP 阶段仅接受 Markdown / TXT | ADR-0001 |
| 切片（Chunk） | 文档正文经切分后的检索最小单元，是向量化的对象 | ADR-0001 |
| 引用（Citation） | 问答答案中标注的答案来源，仅指向来源文档（命中切片按文档去重），不暴露切片原文 | ADR-0001 / ADR-0011 |
| 单用户模式 | MVP 不实现注册/登录/数据隔离；数据模型预留 `user_id` 字段以便未来演进为多用户 | ADR-0002 |
| 本地部署 | docker-compose 仅拉起基础设施（postgres+mongo），api 与 web 在宿主机运行；不追求高可用与云端能力 | ADR-0003（经 ADR-0017 修订） |
| Web 应用（web） | Next.js 前端，面向用户的界面 | ADR-0004 |
| API 服务（api） | NestJS 后端，承载全部业务逻辑与检索管线 | ADR-0004 |
| Monorepo | web 与 api 共存于单一仓库；pnpm workspace 管理 apps/* 与 packages/*，根 `pnpm install` 单摊装齐三包（ADR-0021） | ADR-0004 |
| pgvector | PostgreSQL 的向量扩展，承载切片的 embedding 与余弦相似度检索 | ADR-0005 |
| 双库边界 | PG 管元数据/向量、MongoDB 管正文的分工约定；写入顺序 PG→Mongo，失败标记 `failed`，不做跨库事务 | ADR-0005 |
| 纯向量检索 topK | 查询向量化后按余弦相似度取前 K 个切片（默认 K=5），无全文索引与重排 | ADR-0006 |
| 内部网关 | 同时提供 chat 与 embedding 能力的内部模型服务，模型/baseURL/密钥走环境变量 | ADR-0007 |
| 同步摄取 | 上传请求内完成解析→切片→向量化→落库；保护栏：单文件 ≤2MB、超时 60s、失败可删后重传 | ADR-0008 |
| 无状态问答 | 会话不入库，多轮历史由 web 每次请求全量携带，api 不保存会话状态 | ADR-0009 |
| SSE 流式 | 问答端点以 Server-Sent Events 逐 token 返回；事件序列：引用→正文→结束/错误 | ADR-0010 |
| 文档级引用 | 引用仅标注来源文档（命中切片按文档去重），不暴露切片原文 | ADR-0011 |
| 递归字符切分 | RecursiveCharacterTextSplitter 按 MD 结构符号递归切分，目标 ~500 字符、重叠 ~50 | ADR-0012 |
| shared 契约库 | packages/shared（`@kh/shared` 包）：前后端共享的 DTO 类型/枚举/常量，零框架依赖，类型即契约；api 与 web 均经 `workspace:*` 依赖消费（web 走 transpilePackages） | ADR-0015（载体经 ADR-0021 恢复） |
| 验收剧本 | MVP 完成定义：compose 起 infra → pnpm dev 起应用 → 上传/列表/流式问答/多轮/删除后不再引用，全走通 | design.md |

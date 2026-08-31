# knowledge-hub MVP 设计总览

> 本文档是拷问会话的最终沉淀：汇总 19 项 ADR 决策，给出领域模型、数据模型、API 契约与验收剧本。
> 单项决策的上下文与取舍见 `docs/adr/`，本文档与 ADR 冲突时以 ADR 为准。

## 1. 定位

单用户本地知识库：上传 Markdown/TXT 文档，基于文档内容进行多轮 RAG 问答（SSE 流式、文档级引用）。
核心闭环：**上传 → 向量化 → 问答**。其余一切让路（ADR-0001）。

## 2. 架构总览

```
┌─────────────────────────────────────────────────┐
│ 宿主机 (pnpm dev)                                │
│  ┌──────────────┐        ┌───────────────────┐  │
│  │ web (Next.js)│─HTTP──▶│ api (NestJS)      │  │
│  │ 单页双栏      │  SSE   │  ├─ documents 模块 │  │
│  └──────────────┘        │  ├─ chat 模块      │  │
│                          │  └─ ingest/retrieval│  │
│                          │    (LangChain 边界) │  │
│                          └────┬───────┬───────┘  │
└───────────────────────────────┼───────┼──────────┘
              ┌─────────────────┘       └───────────────┐
┌─────────────▼──────────────┐           ┌──────────────▼────────┐        ┌──────────────┐
│ docker: postgres+pgvector  │           │ docker: mongodb       │        │ 内部网关      │
│ documents / chunks+vector  │           │ document_contents     │        │ chat+embed   │
└────────────────────────────┘           └───────────────────────┘        └──────────────┘
```

- 存储拓扑：PG（元数据+向量） / Mongo（正文），双库边界写入顺序 PG→Mongo，失败标记 `failed`（ADR-0005）。
- LangChain 仅限 api 的 ingest/retrieval 边界，ESLint 强制（ADR-0007）。
- compose 仅含 postgres 与 mongo 两个服务（ADR-0017）。

## 3. 仓库布局（ADR-0014）

```
knowledge-hub/
├── pnpm-workspace.yaml   # packages: apps/* + packages/*（pnpm 11 的 allowBuilds 也在此）
├── package.json          # 仓库根编排：dev/build/lint 经 --filter 下发，dev:all 并发两端
├── apps/
│   ├── web/          # Next.js：单页双栏（ADR-0018），workspace 成员，端口 8000
│   └── api/          # NestJS 标准应用：自带 nest-cli.json（非 monorepo），端口 8001
├── packages/
│   └── shared/       # 契约包 @kh/shared：DTO 类型/枚举/常量，零框架依赖（ADR-0015）
├── deploy/
│   └── docker-compose.yml   # postgres + mongo（ADR-0017）
└── docs/             # 本文档 + adr/ + glossary.md
```

- monorepo 由 pnpm workspace 管理，根 `pnpm install` 单摊装齐三包（ADR-0014）。
- 契约消费：api 与 web 均以 `@kh/shared: workspace:*` 依赖，web 经 next.config `transpilePackages` 消费。

## 4. 领域模型

**聚合**：`Document`（聚合根）→ `Chunk`（从属，随文档创建/删除）。
问答为无状态服务，会话不入库、非领域对象（ADR-0009）。

### PostgreSQL（TypeORM migrations 管理，禁 synchronize）

```sql
CREATE TABLE documents (
  id          uuid PRIMARY KEY,
  title       text NOT NULL,           -- 文件名
  status      text NOT NULL,           -- 'ready' | 'failed'
  user_id     uuid NULL,               -- 预留，多用户演进用（ADR-0002）
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id          uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  seq         int  NOT NULL,           -- 文档内序号
  content     text NOT NULL,
  embedding   vector(<dim>) NOT NULL   -- 维度按所选 embedding 模型配置
);
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
```

### MongoDB（Mongoose）

```
document_contents: { document_id: string (唯一索引), content: string }
```

## 5. API 契约（类型定义以 @kh/shared 为准）

| 端点 | 说明 |
| --- | --- |
| `POST /documents` | multipart 上传；限 MD/TXT、≤2MB；同步摄取（60s 超时），返回文档记录或失败原因（ADR-0008） |
| `GET /documents` | 文档列表（id/title/status/created_at） |
| `DELETE /documents/:id` | 删除文档：PG 行（级联 chunks）+ Mongo 正文，逻辑集中在文档服务（ADR-0005） |
| `POST /chat` | 无状态问答；请求体含 `messages[]`（全量历史），SSE 响应（ADR-0009/0010） |

### SSE 事件序列（`POST /chat`）

```
event: citations   data: { documents: [{ id, title }] }   -- 命中切片按文档去重（ADR-0011）
event: delta       data: { text: "..." }                   -- 逐 token
event: done        data: {}
event: error       data: { message: string }
```

### 问答管线

1. 最新用户消息 → embedding → pgvector 余弦 topK（默认 K=5，可配）（ADR-0006）。
2. 命中切片组装上下文 + 历史消息 → 内部网关 chat 模型 → 流式产出。
3. 引用先于正文发送（ADR-0010）。

### 摄取管线（同步，ADR-0008）

上传 → 校验（类型/大小）→ PG 建 documents 行 → Mongo 写正文 → RecursiveCharacterTextSplitter（~500/50，ADR-0012）→ 批量 embedding → chunks 落 PG → status=ready；任一步失败 status=failed，可删后重传。

## 6. 配置（环境变量）

```
DATABASE_URL / MONGO_URL
LLM_BASE_URL / LLM_API_KEY / LLM_CHAT_MODEL
EMBED_BASE_URL / EMBED_API_KEY / EMBED_MODEL
EMBEDDING_DIM=768
CHUNK_SIZE=500 / CHUNK_OVERLAP=50 / RETRIEVAL_TOP_K=5
UPLOAD_MAX_BYTES=2097152 / INGEST_TIMEOUT_MS=60000
```

## 7. 验收剧本（MVP 完成定义）

1. `docker compose up` 拉起 postgres 与 mongo；根目录 `pnpm install && pnpm dev:all` 同起两端（ADR-0014：单一 workspace install），全链路联通。
2. 上传 3 篇 MD（其中 1 篇 >2MB 被明确拒绝）。
3. 文档列表正确显示状态（ready / failed）。
4. 提问 → SSE 流式答案 + 文档级引用。
5. 多轮追问（历史由前端携带）。
6. 删除某文档后，相同提问不再引用它。

## 8. 演进路线（当前一律不做）

多用户认证与隔离 → 会话持久化 → PDF/DOCX 与异步摄取管线 → 混合检索/重排 → 切片级引用 → 质量评估 → 知识图谱。
任何一项启动前需新立 ADR。

## 9. ADR 索引

| 编号 | 主题 |
| --- | --- |
| 0001 | MVP 核心闭环与范围边界 |
| 0002 | 单用户起步，预留 user_id |
| 0003 | 本地 docker-compose 部署（被 0017 部分修订） |
| 0004 | Monorepo + Next.js + NestJS |
| 0005 | 存储拓扑 PG+pgvector / Mongo（含反对意见记录） |
| 0006 | 纯向量 topK 检索 |
| 0007 | LangChain 接内部网关，边界隔离 |
| 0008 | 同步摄取与保护栏 |
| 0009 | 会话不持久化，无状态问答 |
| 0010 | SSE 流式输出 |
| 0011 | 文档级引用 |
| 0012 | 递归字符切分 |
| 0013 | UUID 主键（附领域模型确认） |
| 0014 | Monorepo 布局与包管理——pnpm workspace |
| 0015 | 契约类型包 packages/shared |
| 0016 | TypeORM + Mongoose |
| 0017 | compose 仅含基础设施（修订 0003） |
| 0018 | web 单页双栏 |
| 0019 | 不做质量系统评估 |

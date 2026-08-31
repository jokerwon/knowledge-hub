# P4：文档模块——上传 / 摄取 / 列表 / 删除（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | ✅ 已完成（2026-08-31，提交 db9b6d0 + 审查修复，见实施记录） |
| 预估 | 10h |
| 前置 | P2（契约）、P3（数据层） |
| 被依赖 | P5（需要已摄取数据）、P6 文档栏 |
| 相关决策 | ADR-0008、ADR-0005、ADR-0012、ADR-0007、ADR-0001、ADR-0002 |

## 目标

交付三个端点：`POST /documents`（multipart 上传 + 同步摄取）、`GET /documents`（列表）、`DELETE /documents/:id`（双库清理）。文档状态仅 `ready` / `failed` 两态。

建议源码布局（api 内）：

```
apps/api/src/documents/   # controller + service：上传校验、删除编排（不导入 langchain）
apps/api/src/ingest/      # 摄取管线：切分 + 向量化（LangChain 边界 ①）
```

## 步骤

### 1. 上传接入（P4-1，1h）

- multer 处理 multipart；扩展名 + MIME 双校验，仅 `.md` / `.txt`；大小 `≤ UPLOAD_MAX_BYTES`（默认 2MB）。
- 违规一律 400，响应体带明确原因。
- 验证：`curl -F "file=@sample.md" localhost:8001/documents` 通过；>2MB 文件与 `.pdf` 均 400。

### 2. POST /documents 骨架（P4-2，0.5h）

- controller 接 `ingest` 服务；同步语义：响应即最终结果（ADR-0008）。

### 3. 摄取①：PG 建行（P4-3，0.5h）

- 第一步即插入 `documents` 行，**初始 `status='failed'`**，成功收尾才改 `ready`——中途崩溃自然留 failed，可删后重传。

### 4. 摄取②：Mongo 正文（P4-4，0.5h）

- 写 `document_contents`。**写入顺序固定 PG → Mongo**，不做跨库事务（ADR-0005）。

### 5. 摄取③：切分（P4-5，1.5h）

- `RecursiveCharacterTextSplitter`：`chunkSize≈CHUNK_SIZE(500)`、`chunkOverlap≈CHUNK_OVERLAP(50)`、分隔符优先 Markdown 结构（标题/段落/换行）再退化字符。
- 保留文档内序号 `seq`，不做富元数据。
- 验证：给定样例文档，切片数与序号可预期、可断言。

### 6. 摄取④：向量化落库（P4-6，2h）

- 边界内（`ingest/`）用 LangChain Embeddings 批量调用网关；**批量并发**控制以压低耗时。
- chunks 批量插入（含 `embedding`）。
- **LangChain import 只允许出现在 `ingest/`**（P7-1 会强制）。

### 7. 收尾与超时栏（P4-7，1h）

- 全流程包 `INGEST_TIMEOUT_MS`（60s）超时（`Promise.race` / AbortSignal）；成功则 `status='ready'`。
- 失败/超时：确保 `documents` 行为 `failed`，尽力删除已写入的 Mongo 正文。
- 验证：把 `LLM_BASE_URL` 指向不可达地址再上传 → 返回失败且列表显示 failed。

### 8. GET /documents（P4-8，0.5h）

- 返回 `DocumentDto[]`（id/title/status/created_at），不暴露 `user_id`。

### 9. DELETE /documents/:id（P4-9，1h）

- **删除逻辑集中在文档服务**（ADR-0005）：删 PG 行（chunks 级联）+ 删 Mongo 正文；目标不存在时幂等返回。
- 验证：删除后 `psql` 查 documents/chunks、`mongosh` 查 document_contents，均无残留。

### 10. 失败路径联验（P4-10，1.5h）

- 走查：超大文件、错类型、网关不可达、超时、删后重传同名文档。
- 检查 `user_id` 统一置 null（或单一来源常量），无多处硬编码单用户假设（ADR-0002）。

## 完成标准

- [x] 合法上传 → 200 且 `ready`；chunks 行数 = 切片数
- [x] 三类违规（超限/错类型/网关故障）均落明确结果
- [x] 列表、删除行为符合契约；双库无残留
- [x] `langchain` 相关 import 未出现在 `documents/` 模块

## 实施记录

### 主要落地（提交 db9b6d0）

- **P4-1 上传校验**：multer 选项由 `DocumentsModule` 经 `MulterModule.registerAsync` 按配置注册（`buildUploadOptions`），`FileInterceptor` 不再传第二参；扩展名白名单（`.md`/`.txt`）+ MIME 兼容校验（`text/*`、空、`application/octet-stream` 放行，与文本冲突的 MIME 拒绝）；`UploadSizeFilter` 把 multer 原生 413 统一为 400。
- **P4-2/3/4 同步摄取编排**：`DocumentsService.ingestUpload` 首步即建 `status='failed'` 行，成功收尾才改 `ready`；写入顺序固定 PG → Mongo → 摄取（ADR-0005）。
- **P4-5 切分**：`ingest/text-splitter.ts` 包 `RecursiveCharacterTextSplitter.fromLanguage('markdown')`；`text-splitter.spec.ts` 4 个用例覆盖空文档、单片、字符级递归（数量/重叠/无丢失可断言）、Markdown 结构优先。
- **P4-6 向量化**：`ingest/embeddings-client.ts` 自建小并发池（批 16、并发 4）替代 `embedDocuments` 的全并发 `Promise.all`；维度校验（`EMBEDDING_DIM`）落 `EmbeddingDimensionError`；配置缺失 fail-fast（`EmbeddingConfigError`）。Embedding 网关配置独立于 LLM 网关（`EMBED_BASE_URL / EMBED_API_KEY / EMBED_MODEL`，两服务可能分开部署）。
- **P4-7 超时栏**：全流程 `Promise.race` 包 `INGEST_TIMEOUT_MS`；AbortSignal 贯穿管线各步；输掉的分支 `pipeline.catch(() => undefined)` 防 unhandled rejection；`finally clearTimeout`。
- **P4-8 列表**：`select` 只取契约四字段，不暴露 `user_id`，不触碰 embedding 列。
- **P4-9 删除**：PG 行删除（chunks 级联）+ Mongo 正文删除，均无条件执行 → 幂等。
- **P4-10 失败路径**：失败/超时清理集中 `cleanupFailed`（chunks + Mongo 正文尽力删除，各自容错记日志）；`IngestTimeoutError` → 504，其余 → 500，消息带原因。

### 审查修复（2026-08-31，NestJS 最佳实践走查）

- `MONGO_URL` 未配置时启动即 fail-fast（对齐 `DATABASE_URL` 的处理），不再静默空串。
- `main.ts` 增加 `app.enableShutdownHooks()`，SIGTERM 时关闭 PG/Mongo 连接。
- 新增 `AppConfigProviderModule` 集中注册 `APP_CONFIG`，移除三个模块的重复 provide。
- `@Param('id', ParseUUIDPipe)` 替代 service 内手写 UUID 正则。
- 删除 `DocumentEntity.chunks` 未使用的 `cascade: true`。

### 已知限制 / 遗留

- `file.buffer.toString('utf8')`：UTF-16 等非 UTF-8 编码的 `.txt` 会静默乱码。单用户内部工具可接受；多编码支持待需要时再加。
- `DocumentsService` 的编排逻辑（超时 race、失败清理、双库删除）暂无单测，建议随 P5 一并补。
- 无 rate limiting / helmet / CORS：ADR-0002 单用户前提下推迟，认证接入时一起补。
- P4 完成时 `apps/api/test/`（e2e 脚手架）被删除，e2e 待 P5 端点成型后重建。

# P5：检索与问答（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | ⬜ 未开始（P5-1 网关冒烟可提前：`LLM_*` 填好即可开工；开放项 3 未拍板） |
| 预估 | 10h |
| 前置 | P2（契约）、P3（数据层）；联调需 P4 已摄取数据 |
| 被依赖 | P6 流式问答、P7 验收 |
| 相关决策 | ADR-0006、ADR-0007、ADR-0009、ADR-0010、ADR-0011 |

## 目标

交付 `POST /chat`：无状态问答，纯向量 topK 检索，SSE 流式输出（citations → delta* → done / error），文档级引用。

建议源码布局（api 内）：

```
apps/api/src/retrieval/   # topK 检索 + LLM 流（LangChain 边界 ②）
apps/api/src/chat/        # POST /chat SSE controller（只依赖 retrieval 的接口，不直接导入 langchain）
```

## 步骤

### 1. 网关冒烟（P5-1，1h）★ 可提前

只要 `LLM_*` 环境变量就位即可开工，不必等 P3/P4。

- 最小脚本分别调网关的 chat completions 与 embeddings 各一次。
- **产出结论**：网关是否 OpenAI 兼容 → 决定步骤 2 用 LangChain openai 系包还是边界内自写适配层（ADR-0007 预留验证点）。

### 2. LLM 边界工厂（P5-2，2h）

- `retrieval/`（或与 ingest 共享的 llm 边界）内统一工厂：由 `LLM_BASE_URL / LLM_API_KEY / LLM_CHAT_MODEL / LLM_EMBED_MODEL` 构造 Chat 模型与 Embeddings。
- P4 的 Embeddings 调用建议收敛到同一工厂，避免两套配置。
- 不兼容时在工厂内加适配层，**不向边界外扩散**。

### 3. 检索服务（P5-3，1.5h）

- 最新用户消息 → embedding → 余弦 topK（原生 SQL，`RETRIEVAL_TOP_K` 默认 5）：

```sql
SELECT c.id, c.document_id, c.seq, c.content, d.title
FROM chunks c
JOIN documents d ON d.id = c.document_id
WHERE d.status = 'ready'
ORDER BY c.embedding <=> $1
LIMIT $2;
```

- 不做全文索引、不做重排（ADR-0006）。

### 4. 上下文组装（P5-4，1h）

- system prompt + 命中切片拼接 + `messages[]` 历史 → chat 模型。

### 5. SSE 端点（P5-5，2h）

- `POST /chat` 请求体 `ChatRequest`；**无状态，不落任何存储**（ADR-0009）。
- 手工写 `text/event-stream`（POST 不能用框架 @Sse 的 EventSource 语义，直接操作 response）：
  ```
  event: citations   data: {"documents":[{"id":"...","title":"..."}]}
  event: delta       data: {"text":"..."}
  event: done        data: {}
  event: error       data: {"message":"..."}
  ```
- **引用先于正文发送**；事件结构以 `@kh/shared` 契约为准。

### 6. 引用去重（P5-6，0.5h）

- 命中切片按 `document_id` 去重，仅输出 `{ id, title }`，不暴露切片原文（ADR-0011）。

### 7. 断连处理（P5-7，1h）

- 监听请求 `close`，及时中止 LLM 流，避免空转烧 token。
- 验证：`curl -N` 中途 Ctrl-C，服务端日志确认流终止。

### 8. 零命中与联验（P5-8，1h）

- 零命中行为按拍板结论实现（开放项 3，契约不变）。
- 多轮联验：携带历史的第二次提问，答案体现上下文。

## 验证脚本

```bash
# 先经 P4 上传至少 1 篇文档
curl -N -X POST localhost:8001/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"<文档内可命中的问题>"}]}'
```

预期：先 `citations`（去重后文档列表）→ 多条 `delta` → `done`。

## 完成标准

- [ ] 事件序列与契约完全一致，引用文档级去重
- [ ] 多轮携带历史行为正确
- [ ] 断连即止流；异常走 `error` 事件
- [ ] `langchain` import 仅存在于 `retrieval/` 与 `ingest/`

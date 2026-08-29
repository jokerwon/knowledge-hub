# P2：契约包 packages/shared（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | ⬜ 未开始（前置 P0-5 契约接线已打通，shared 现仅占位常量 `APP_NAME`） |
| 预估 | 3h |
| 前置 | P0 完成（尤其 P0-5 契约接线已打通） |
| 被依赖 | P4、P5、P6 的接口实现与联调 |
| 相关决策 | ADR-0015（实质约束）、ADR-0014（载体） |

## 目标

在 `packages/shared`（`@kh/shared`）定义前后端共享的全部契约：文档/问答 DTO、SSE 事件、常量。**只含类型与纯常量，零运行时逻辑、零框架依赖**；类型即契约，任一端契约漂移编译即报错。

## 步骤

### 1. 文档域契约（P2-1，0.5h）

```ts
export type DocumentStatus = 'ready' | 'failed';
export interface DocumentDto {
  id: string;            // uuid，TS 侧一律 string（ADR-0013）
  title: string;
  status: DocumentStatus;
  created_at: string;    // ISO 时间
}
```

### 2. 问答域契约（P2-2，0.5h）

```ts
export type ChatRole = 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string; }
export interface ChatRequest { messages: ChatMessage[]; }  // 全量历史，无状态（ADR-0009）
```

### 3. SSE 事件契约（P2-3，1h）——单一事实来源

```ts
export const SSE_EVENT = {
  citations: 'citations', delta: 'delta', done: 'done', error: 'error',
} as const;

export interface Citation { id: string; title: string; }          // 文档级，无切片字段（ADR-0011）
export interface CitationsPayload { documents: Citation[]; }
export interface DeltaPayload { text: string; }
export interface ErrorPayload { message: string; }

export type SseEvent =
  | { event: typeof SSE_EVENT.citations; data: CitationsPayload }
  | { event: typeof SSE_EVENT.delta; data: DeltaPayload }
  | { event: typeof SSE_EVENT.done; data: Record<string, never> }
  | { event: typeof SSE_EVENT.error; data: ErrorPayload };
```

### 4. 常量（P2-4，0.5h）

- `DEFAULT_RETRIEVAL_TOP_K = 5`、`DEFAULT_MAX_UPLOAD_BYTES = 2_097_152` 等，默认值与环境变量默认保持一致（design.md §6）。

### 5. 零依赖体检（P2-5，0.5h）

- `packages/shared` 的 package 依赖为空；不出现任何 nest / next / langchain import。
- 编译两端各一次：api 与 web 均经 `@kh/shared` workspace 依赖，均通过（web 无需 `transpilePackages`：Next 16 Turbopack 对 App Router 自动转译 workspace 包，P0-5 已实测）。

## 完成标准

- [ ] 三类契约 + 常量全部定义且导出
- [ ] api、web 两端编译通过
- [ ] 依赖体检零框架依赖

## 约定

- 此后任何接口变更先改 `packages/shared`，由编译错误驱动两端同步——这是强制同步机制本身，不另设流程。

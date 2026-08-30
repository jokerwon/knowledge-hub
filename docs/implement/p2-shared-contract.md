# P2：契约包 packages/shared（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | ✅ 已完成（2026-08-30，提交 c1335c1，见实施记录） |
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

- [x] 三类契约 + 常量全部定义且导出
- [x] api、web 两端编译通过
- [x] 依赖体检零框架依赖

## 约定

- 此后任何接口变更先改 `packages/shared`，由编译错误驱动两端同步——这是强制同步机制本身，不另设流程。

## 实施记录

### 已执行（2026-08-30）

- **P2-1 文档域**：新增 `packages/shared/src/document.ts`，导出 `DocumentStatus`、`DocumentDto`，字段 snake_case 与存储层对齐（ADR-0013）。
- **P2-2 问答域**：新增 `chat.ts`，导出 `ChatRole`、`ChatMessage`、`ChatRequest`；请求携带全量历史，服务端无状态（ADR-0009）。
- **P2-3 SSE 事件**：新增 `sse.ts`，`SSE_EVENT` 为 `as const` 常量，`SseEvent` 用判别联合（discriminated union）覆盖 citations/delta/done/error 四类事件；`Citation` 仅 `id` + `title`，无切片字段（ADR-0011）。
- **P2-4 常量**：新增 `constants.ts`，将 `APP_NAME` 从 index.ts 迁出，并补齐 `DEFAULT_RETRIEVAL_TOP_K=5`、`DEFAULT_MAX_UPLOAD_BYTES=2_097_152`、`DEFAULT_CHUNK_SIZE=500`、`DEFAULT_CHUNK_OVERLAP=50`、`DEFAULT_INGEST_TIMEOUT_MS=60_000`，与 `.env` 默认值对齐。
- **入口**：`index.ts` 改为聚合导出，仅含类型与纯常量，零运行时逻辑。
- **import 写法**：使用显式 `.js` 扩展（`export * from './document.js'`），满足 `module: nodenext` 下 ESM 规范。

### P2-5 零依赖体检（通过）

| 项 | 结果 |
| --- | --- |
| shared `dependencies` | 空 |
| shared `peerDependencies` | 空 |
| shared `devDependencies` | 仅 `typescript ^6.0.3` |
| `pnpm --filter @kh/shared build` | ✅ tsc 输出 dist/ 含 5 个 .js + 5 个 .d.ts |
| `pnpm --filter api build`（nest build） | ✅ 通过 |
| `pnpm --filter web build`（Next 16 Turbopack + TS 检查） | ✅ 通过 |

### 提交

- `c1335c1` `feat(shared): P2 共享契约——文档/问答/SSE 事件与共享常量统一由 @kh/shared 导出`（5 files, +74/−1）

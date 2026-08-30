// SSE 事件契约：问答流式推送的单一事实来源。
// SSE_EVENT 常量与 payload 类型必须同步演进（任一端漂移即编译失败）。

export const SSE_EVENT = {
  citations: 'citations',
  delta: 'delta',
  done: 'done',
  error: 'error',
} as const;

export type SseEventType = (typeof SSE_EVENT)[keyof typeof SSE_EVENT];

export interface Citation {
  id: string;
  title: string; // 文档级，无切片字段（ADR-0011）
}

export interface CitationsPayload {
  documents: Citation[];
}

export interface DeltaPayload {
  text: string;
}

export interface ErrorPayload {
  message: string;
}

export type SseEvent =
  | { event: typeof SSE_EVENT.citations; data: CitationsPayload }
  | { event: typeof SSE_EVENT.delta; data: DeltaPayload }
  | { event: typeof SSE_EVENT.done; data: Record<string, never> }
  | { event: typeof SSE_EVENT.error; data: ErrorPayload };

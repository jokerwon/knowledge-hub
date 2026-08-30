// 问答域契约：聊天消息与请求形状。
// 请求携带全量历史，服务端无状态（ADR-0009）。

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

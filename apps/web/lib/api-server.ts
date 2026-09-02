import type { DocumentDto } from "@kh/shared";

// 服务端专用模块：RSC 与 Server Action 都经 Next 服务器访问 api。
// api 不开 CORS、不暴露给浏览器（浏览器只与 Next 通信）。
export const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8001";

export async function fetchDocuments(): Promise<DocumentDto[]> {
  const res = await fetch(`${apiBaseUrl}/documents`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /documents 失败：HTTP ${res.status}`);
  }
  return res.json();
}

// Nest 错误体形如 { statusCode, message, error }；message 可能是 string 或 string[]。
export async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join("；");
    }
  } catch {
    // 非 JSON 响应体，走兜底文案
  }
  return `请求失败（HTTP ${res.status}）`;
}

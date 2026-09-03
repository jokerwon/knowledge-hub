import type { AuthUserDto, DocumentDto, LoginRequest } from "@kh/shared"


import { getSessionToken } from "./session"

// 服务端专用模块：RSC 与 Server Action 都经 Next 服务器访问 api。
// api 不开 CORS、不暴露给浏览器（浏览器只与 Next 通信）。
export const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8001"

// api 返回 401（未登录 / 过期 / 改密后被吊销）。
// 抛专用异常而非直接 redirect()：调用方的 catch 不会误吞跳转语义，
// 由调用点显式决定是跳登录页还是当作业务错误（如登录接口的密码错误）。
export class UnauthorizedError extends Error {
  constructor() {
    super("未登录或登录已失效")
    this.name = "UnauthorizedError"
  }
}

// 统一出口：附加 Bearer token；401 抛 UnauthorizedError。
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getSessionToken()
  let res: Response
  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    // 网络错误不视为未登录：api 宕机时页面展示连接错误，而不是踢去登录页。
    throw new ApiUnreachableError()
  }
  if (res.status === 401) throw new UnauthorizedError()
  return res
}

// api 不可达（连接拒绝 / 超时）。调用方以连接错误文案提示。
export class ApiUnreachableError extends Error {
  constructor() {
    super("无法连接 api")
    this.name = "ApiUnreachableError"
  }
}

export async function fetchMe(): Promise<AuthUserDto> {
  const res = await apiFetch("/auth/me")
  if (!res.ok) throw new Error(`GET /auth/me 失败：HTTP ${res.status}`)
  return res.json()
}

export async function fetchDocuments(): Promise<DocumentDto[]> {
  const res = await apiFetch("/documents")
  if (!res.ok) {
    throw new Error(`GET /documents 失败：HTTP ${res.status}`)
  }
  return res.json()
}

// 登录不经过 apiFetch：登录接口的 401 是密码错误（业务错误），不能触发跳登录语义。
// 改密走 apiFetch（需要 Bearer；401=会话失效应跳登录，400=旧密码错误是业务错误）。
export async function loginRequest(body: LoginRequest): Promise<Response> {
  return fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

// Nest 错误体形如 { statusCode, message, error }；message 可能是 string 或 string[]。
export async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] }
    if (typeof body.message === "string") return body.message
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join("；")
    }
  } catch {
    // 非 JSON 响应体，走兜底文案
  }
  return `请求失败（HTTP ${res.status}）`
}

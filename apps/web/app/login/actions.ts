"use server"

import { redirect } from "next/navigation"
import type { LoginResponse } from "@kh/shared"

import { loginRequest } from "@/lib/api-server"
import { clearSessionCookie, setSessionCookie } from "@/lib/session"

export interface LoginState {
  error?: string
}

// next 只接受站内相对路径（防开放重定向），非法值回落 /dashboard。
function safeNextPath(raw: string): string {
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw
  return "/dashboard"
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!username || !password) {
    return { error: "请输入用户名和密码" }
  }

  let res: Response
  try {
    res = await loginRequest({ username, password })
  } catch {
    return { error: "无法连接服务，请确认 api 是否在运行" }
  }
  if (!res.ok) {
    return { error: "用户名或密码错误" }
  }

  const body = (await res.json()) as LoginResponse
  await setSessionCookie(body.access_token)
  // redirect 抛 NEXT_REDIRECT 结束 action；成功路径无返回值。
  redirect(safeNextPath(String(formData.get("next") ?? "")))
}

// 登出：JWT 无服务端状态，清 cookie 即可。
export async function logout(): Promise<void> {
  await clearSessionCookie()
  redirect("/login")
}

"use server"

import { redirect } from "next/navigation"
import type { LoginResponse } from "@kh/shared"

import { UnauthorizedError, apiFetch, parseApiError } from "@/lib/api-server"
import { setSessionCookie } from "@/lib/session"

export interface ChangePasswordState {
  error?: string
  success?: string
}

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const oldPassword = String(formData.get("old_password") ?? "")
  const newPassword = String(formData.get("new_password") ?? "")
  const confirmPassword = String(formData.get("confirm_password") ?? "")

  if (!oldPassword || !newPassword || !confirmPassword) {
    return { error: "请填写所有字段" }
  }
  if (newPassword.length < 8) {
    return { error: "新密码至少 8 个字符" }
  }
  if (newPassword.length > 72) {
    return { error: "新密码不能超过 72 个字符" }
  }
  if (newPassword !== confirmPassword) {
    return { error: "两次输入的新密码不一致" }
  }

  let res: Response
  try {
    res = await apiFetch("/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    })
  } catch (error) {
    // 401：会话已失效（不是旧密码错误，那是 400），跳登录页。
    if (error instanceof UnauthorizedError) redirect("/login")
    return { error: "无法连接服务，请确认 api 是否在运行" }
  }
  if (!res.ok) {
    return { error: await parseApiError(res) }
  }

  // 用新 token 覆盖 cookie：当前会话不掉线；
  // 其他设备的旧 token 已被 tokenVersion 机制吊销。
  const body = (await res.json()) as LoginResponse
  await setSessionCookie(body.access_token)
  return { success: "密码已修改，其他设备已强制下线" }
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { UnauthorizedError, apiFetch, parseApiError } from "@/lib/api-server"

export interface ActionResult {
  ok: boolean
  error?: string
}

// 上传：把客户端 File 以 multipart 转发给 api（字段名 file，与 UPLOAD_FIELD 一致）。
export async function uploadDocument(file: File): Promise<ActionResult> {
  const form = new FormData()
  form.append("file", file)
  let res: Response
  try {
    res = await apiFetch("/documents", { method: "POST", body: form })
  } catch (error) {
    // 会话失效跳登录（redirect 抛 NEXT_REDIRECT，不能被 catch 吞掉故先判类型）；
    // 其余（连接失败）按连接错误提示。
    if (error instanceof UnauthorizedError) redirect("/login")
    return { ok: false, error: "无法连接文档服务，请确认 api 是否在运行" }
  }
  if (!res.ok) {
    return { ok: false, error: await parseApiError(res) }
  }
  revalidatePath("/documents")
  return { ok: true }
}

// 删除：api 侧为软删除（deleted_at），列表自动排除已删除行。
export async function deleteDocument(id: string): Promise<ActionResult> {
  let res: Response
  try {
    res = await apiFetch(`/documents/${id}`, { method: "DELETE" })
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login")
    return { ok: false, error: "无法连接文档服务，请确认 api 是否在运行" }
  }
  if (!res.ok) {
    return { ok: false, error: await parseApiError(res) }
  }
  revalidatePath("/documents")
  return { ok: true }
}

"use server";

import { revalidatePath } from "next/cache";

import { apiBaseUrl, parseApiError } from "@/lib/api-server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// 上传：把客户端 File 以 multipart 转发给 api（字段名 file，与 UPLOAD_FIELD 一致）。
export async function uploadDocument(file: File): Promise<ActionResult> {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${apiBaseUrl}/documents`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      return { ok: false, error: await parseApiError(res) };
    }
  } catch {
    return { ok: false, error: "无法连接文档服务，请确认 api 是否在运行" };
  }
  revalidatePath("/documents");
  return { ok: true };
}

// 删除：api 侧为软删除（deleted_at），列表自动排除已删除行。
export async function deleteDocument(id: string): Promise<ActionResult> {
  try {
    const res = await fetch(`${apiBaseUrl}/documents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      return { ok: false, error: await parseApiError(res) };
    }
  } catch {
    return { ok: false, error: "无法连接文档服务，请确认 api 是否在运行" };
  }
  revalidatePath("/documents");
  return { ok: true };
}

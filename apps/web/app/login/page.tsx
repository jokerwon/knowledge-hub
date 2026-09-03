import { redirect } from "next/navigation"

import { UnauthorizedError, fetchMe } from "@/lib/api-server"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "登录 — Knowledge Hub",
}

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  // 已登录（cookie 仍有效）直接回应用；
  // 401 渲染表单；api 不可达也渲染表单，提交时再报连接错误。
  // redirect 放在 try 之外：NEXT_REDIRECT 不能被 catch 吞掉。
  let loggedIn = false
  try {
    await fetchMe()
    loggedIn = true
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      // api 暂不可达，忽略：表单照常展示
    }
  }
  if (loggedIn) redirect("/dashboard")

  const { next } = await searchParams
  const nextPath = typeof next === "string" ? next : undefined

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center p-6">
      <LoginForm next={nextPath} />
    </div>
  )
}

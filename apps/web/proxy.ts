import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@kh/shared"

// 轻量门槛：只查 cookie 是否存在（proxy 运行时不验证 JWT）。
// 真正的鉴权在 api（全局 guard）与 (app) 布局（/auth/me），
// 因此这里不把「已带 cookie 的 /login」重定向走——cookie 可能已失效，
// 那样会与布局层的跳登录形成循环；/login 页面自行探测已登录态。
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  if (pathname === "/login") return NextResponse.next()
  if (hasSession) return NextResponse.next()

  const loginUrl = new URL("/login", request.url)
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

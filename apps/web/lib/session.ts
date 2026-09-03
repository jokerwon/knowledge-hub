import { cookies } from "next/headers"
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@kh/shared"

// 会话 cookie 由 Next 服务器独占读写（httpOnly），浏览器不感知内容；
// 后续 RSC / Server Action 经 api-server 附加 Authorization 转发给 api。

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

// 仅可在 Server Action / Route Handler 中调用（RSC 中 cookies().set 会抛错）。
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // 内网 HTTP 部署：不开 Secure（开了 cookie 反而不落）。
    secure: false,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

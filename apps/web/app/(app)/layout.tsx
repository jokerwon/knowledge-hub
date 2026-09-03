import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { UnauthorizedError, fetchMe } from "@/lib/api-server"

// 应用壳布局：先过鉴权门（/auth/me），再挂侧边栏与顶栏。
// 401（未登录/过期/改密被吊销）→ 跳登录页；api 不可达 → 让 Next 报错页（服务故障不该伪装成未登录）。
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let me: Awaited<ReturnType<typeof fetchMe>>
  try {
    me = await fetchMe()
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login")
    throw error
  }

  return (
    <SidebarProvider>
      <AppSidebar username={me.username} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

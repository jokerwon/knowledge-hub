"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  FileTextIcon,
  GalleryVerticalEndIcon,
  LayoutDashboardIcon,
} from "lucide-react"
// 真实导航:仪表盘独立成组,文档管理归入「内容」;无假数据、无占位链接。
const navOverview = [
  {
    title: "仪表盘",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
  },
]

const navContent = [
  {
    title: "文档",
    url: "/documents",
    icon: FileTextIcon,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GalleryVerticalEndIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Knowledge Hub</span>
                <span className="truncate text-xs text-muted-foreground">
                  Your team&apos;s knowledge, in order
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={navOverview} />
        <NavGroup label="内容" items={navContent} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function NavGroup({
  label,
  items,
}: {
  label?: string
  items: Array<{
    title: string
    url: string
    icon: React.ComponentType<{ className?: string }>
  }>
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              isActive={pathname === item.url}
              tooltip={item.title}
              render={<Link href={item.url} />}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

import "./globals.css";

// shadcn 默认字体接线：next/font/google Geist / Geist Mono，
// 分别暴露 --font-sans / --font-mono 变量。
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Knowledge Hub — Your team's knowledge, in order",
  description:
    "Knowledge Hub turns docs, decisions, and discussion into a structured system — searchable in milliseconds and linked to every issue and PR.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// 根布局只保留 html 骨架；应用壳（侧边栏/顶栏/鉴权门）在 (app) 组布局，
// 登录页 (app/login) 因此天然不带侧边栏。
// 明暗主题由 next-themes 管理（class 策略，默认跟随系统），首帧无闪烁。
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

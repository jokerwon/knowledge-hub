"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * 明暗切换入口：next-themes（class 策略，默认跟随系统）。
 * 图标显隐纯由 <html> 的 .dark class 驱动，CSS 层面切换，
 * 水合期间不会出现图标与主题不一致。
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="切换颜色主题"
    >
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
    </Button>
  );
}

"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Toggles the dark (default) / light canvas. The choice persists in
 * localStorage and is re-applied pre-paint by the inline script in the
 * root layout. Icons are driven purely by the <html> theme class, so they
 * can never mismatch during hydration.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isLight = root.classList.toggle("light");
    root.classList.toggle("dark", !isLight);
    try {
      localStorage.setItem("theme", isLight ? "light" : "dark");
    } catch {
      // storage unavailable (private mode) — session-only theme
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle color theme"
    >
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
    </Button>
  );
}

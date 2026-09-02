"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/site/theme-toggle";

import { Button } from "@/components/ui/button";

import { Logo } from "@/components/site/logo";

const links = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#workflow" },
  { label: "Customers", href: "#customers" },
  { label: "Changelog", href: "#changelog" },
];

export function TopNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/85 backdrop-blur-md">
      {/* top-nav: 56px bar, canvas background, body-sm links */}
      <nav className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#" aria-label="Knowledge Hub home" className="rounded-md">
          <Logo />
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-body-sm text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="secondary">Sign in</Button>
            <Button>Get started</Button>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex size-9 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-hairline bg-canvas px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-body-sm text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" className="w-full">
              Sign in
            </Button>
            <Button className="w-full">Get started</Button>
          </div>
        </div>
      )}
    </header>
  );
}

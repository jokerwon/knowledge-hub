import { cn } from "@/lib/utils"

/** Brand mark — the one place lavender lives outside CTAs, focus, and links. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="var(--primary)"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <rect x="2" y="3.5" width="16" height="3" rx="1" />
      <rect x="2" y="8.5" width="11" height="3" rx="1" />
      <rect x="2" y="13.5" width="6" height="3" rx="1" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-sm font-semibold tracking-tight text-ink">
        Knowledge Hub
      </span>
    </span>
  )
}

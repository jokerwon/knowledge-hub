"use client"

import { GalleryVerticalEndIcon } from "lucide-react"
import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { login, type LoginState } from "./actions"

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  )

  return (
    <form
      action={formAction}
      className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-hairline bg-surface-1 p-8"
    >
      <input type="hidden" name="next" value={next ?? ""} />

      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GalleryVerticalEndIcon className="size-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-ink">Knowledge Hub</h1>
          <p className="truncate text-xs text-ink-muted">
            受邀账号由管理员创建，不开放注册
          </p>
        </div>
      </div>

      <FieldGroup>
        <Field data-invalid={state.error ? true : undefined}>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            required
            placeholder="username"
            aria-invalid={state.error ? true : undefined}
          />
        </Field>
        <Field data-invalid={state.error ? true : undefined}>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            aria-invalid={state.error ? true : undefined}
          />
        </Field>
      </FieldGroup>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "登录中…" : "登录"}
      </Button>
    </form>
  )
}

"use client"

import { useActionState } from "react"

import { changePassword, type ChangePasswordState } from "@/app/(app)/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const FIELDS = [
  {
    id: "old_password",
    label: "旧密码",
    autoComplete: "current-password",
  },
  {
    id: "new_password",
    label: "新密码（至少 8 个字符）",
    autoComplete: "new-password",
  },
  {
    id: "confirm_password",
    label: "确认新密码",
    autoComplete: "new-password",
  },
] as const

// 改密对话框：由 NavUser 弹出层菜单打开。
// 挂载即开（父组件条件渲染），关闭即卸载——下次打开是干净的表单与状态。
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] =
    useActionState<ChangePasswordState, FormData>(changePassword, {})

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>
            修改后当前会话保持登录，其他设备将被强制下线。
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <FieldGroup>
            {FIELDS.map((field) => (
              <Field
                key={field.id}
                data-invalid={state.error ? true : undefined}
              >
                <FieldLabel htmlFor={field.id}>{field.label}</FieldLabel>
                <Input
                  id={field.id}
                  name={field.id}
                  type="password"
                  autoComplete={field.autoComplete}
                  required
                  aria-invalid={state.error ? true : undefined}
                />
              </Field>
            ))}
          </FieldGroup>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-success" role="status">
              {state.success}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {state.success ? "关闭" : "取消"}
            </Button>
            {state.success ? null : (
              <Button type="submit" disabled={pending}>
                {pending ? "提交中…" : "修改密码"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

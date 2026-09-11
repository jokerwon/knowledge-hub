<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# UI 规范：shadcn 默认主题

主题为 shadcn 默认（base-nova / neutral，preset `b2fA`）：明色 `:root` 是默认外观，暗色经 html `.dark` class（next-themes class 策略，默认跟随系统）。`app/globals.css` 是唯一主题事实源，只维护 shadcn 语义 token，不引入自定义 token / 工具类。

## 取色取字：只经语义 token（app/globals.css）

- 颜色一律用 shadcn 语义类：`bg-background` / `bg-card` / `bg-muted` / `bg-accent` / `text-muted-foreground` / `border-border` / `ring-ring` 等，组件内禁止硬编码 hex。
- 默认主题没有 success token：成功/强调态复用 `primary`，失败态用 `destructive`。
- 排版直接用 Tailwind 内置工具类（页题用 `text-2xl font-semibold tracking-tight` 等），不引入自定义排版工具类。
- 圆角走默认 radius 派生（`--radius: 0.625rem` → sm/md/lg/xl…），不要用固定 px 覆盖。

## 主题机制

- next-themes 统一管理：`components/theme-provider.tsx`（class 策略，默认跟随系统），切换入口是顶栏 `ThemeToggle`。不要自写 localStorage 注入脚本，不要引入第二套主题机制，也不注册全局快捷键。
- 字体走 `next/font/google` 的 Geist / Geist Mono（暴露 `--font-sans` / `--font-mono`），不加其它字体依赖。

## shadcn 组件

- `components/ui/*` 是 vendored 底座：新增组件用 `pnpm dlx shadcn@latest add <name>` 取默认实现；定制优先用组件自带 variant，不重写其颜色体系。
- 升级组件先用 `add <name> --diff` 比对本地改动再合并，不要手抄 GitHub 源码。

## 流程

- UI 改动完成：`pnpm --filter web lint && pnpm --filter web build` 必须通过。

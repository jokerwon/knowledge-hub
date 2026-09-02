<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# 设计规范：DESIGN.md 是唯一事实源

任何 UI 工作（新建组件、改样式、加页面）之前，先读 [DESIGN.md](./DESIGN.md) 的相关章节。本节是执行摘要，冲突时以 DESIGN.md 为准。

## 取色取字：只经 token 层（app/globals.css）

- 颜色一律走 CSS 变量与 Tailwind 语义类，组件内禁止硬编码 hex。
- Linear 调色板是一等工具类：`bg-canvas`、`bg-surface-1`…`bg-surface-4`、`border-hairline{,-strong,-tertiary}`、`text-ink{,-muted,-subtle,-tertiary}`、`bg-primary` / `text-on-primary`、`bg-inverse-canvas`、`bg-success`。
- shadcn 语义类（`bg-background` / `bg-card` / `bg-muted` / `bg-accent` / `ring-ring` …）已在 globals.css 映射到 Linear token，shadcn 组件直接用语义类。
- 排版用现成工具类（自带响应式降级与 tracking）：`text-display-xl|display-lg|display-md|headline|card-title|subhead|body-lg|body|body-sm|caption|eyebrow`；等宽只走 `font-mono`。
- 圆角：按钮/输入 `rounded-md`（8px）、卡片 `rounded-lg`（12px）、截图面板 `rounded-xl`（16px）；CTA 永不 pill。
- 提升面板质感用 `panel-highlight`（顶部 1px 内描边）——surface 阶梯之外唯一允许的深度。

## 硬约束（违反即返工）

1. 熏衣草紫 `--primary`（#5e6ad2）是唯一彩色强调，只用于品牌标、主 CTA、focus ring、链接强调。不做大面积底色，不引入第二个彩色（营销画布唯一语义色是 `--success`）。
2. 层级靠 surface 阶梯（canvas → surface-1…4）+ 1px hairline 边框：无阴影、无渐变、无聚光卡片。
3. 暗色 #010102 是默认锚定画布；亮色是显式可选项，机制为 html `.light` class + localStorage 持久化（见 app/layout.tsx 的 themeInitScript 与 components/site/theme-toggle.tsx）。禁止引入 next-themes 等主题库。
4. 新颜色必须同时落三处：DESIGN.md front matter、globals.css `:root`、globals.css `.light`（亮色是机械镜像，映射表见 DESIGN.md「Light Theme」节）。缺一不可。
5. 字体用自托管 Geist Sans / Geist Mono（DESIGN.md 认可的 Linear 替代），经 `geist` 包注入，不加其它字体依赖。
6. 展示字重上限 600（body 400），禁止 700+；display 的负 tracking 已内置于 `text-display-*` 工具类，勿手写。

## shadcn 组件

- `components/ui/*` 是 vendored 底座，主题化只经 token 与工具类。新增变体须对应 DESIGN.md `components:` 条目，并在代码注释里标注对应 token——参考 `components/ui/button.tsx`。
- 需要 DESIGN.md 未定义的组件时，先在 DESIGN.md 补 `components:` 条目，再写代码。

## 流程

- 修改了 DESIGN.md 本身：跑 `npx @google/design.md lint DESIGN.md`。
- UI 改动完成：`pnpm --filter web lint && pnpm --filter web build` 必须通过。

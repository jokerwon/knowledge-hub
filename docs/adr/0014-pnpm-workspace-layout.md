# ADR-0014：Monorepo 布局——pnpm workspace

- 状态：已被 ADR-0020 取代（2026-08-28）
- 日期：2026-08-28

## 背景

ADR-0004 确定 monorepo，但布局可选 pnpm workspace、Turborepo、NestJS 官方 monorepo 模式。

## 决策

- 使用 **pnpm workspace**，结构：
  - `apps/web` — Next.js 前端
  - `apps/api` — NestJS 后端
  - `packages/shared` — 共享契约包（见 ADR-0015）
  - `deploy/` — docker-compose 及相关部署文件
- 根 `package.json` 统一编排脚本（dev/build/lint），不引入 Turborepo 等编排层。
- 不采用 NestJS 官方 monorepo 模式（其对 Nest 库友好，但承载 Next.js 应用别扭）。

## 后果

- 布局直白、工具链原生；两应用规模下构建编排收益本就可忽略。
- 新增包时直接在 workspace 内新建目录并登记，无额外配置。

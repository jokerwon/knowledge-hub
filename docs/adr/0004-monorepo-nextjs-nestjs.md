# ADR-0004：Monorepo + Next.js 前端 + NestJS 后端

- 状态：已接受（既定约束）
- 日期：2026-08-28

## 背景

项目启动时由使用者直接给定两项技术约束：单仓 monorepo 组织代码；前端 Next.js、后端 NestJS。

## 决策

- 仓库为 **monorepo**：`apps/web`（Next.js）与 `apps/api`（NestJS）共存，共享契约与工具链。
- 前后端**进程分离**：web 只通过 HTTP API 与 api 通信，不共享数据库、不互相导入服务端代码。
- 前后端共享的 DTO/类型契约以独立包形式沉淀（具体包管理布局见后续 ADR）。

## 后果

- TypeScript 全栈统一语言与类型契约，前后端联调成本低。
- web 可独立替换而不影响 api；api 也可被其他客户端复用。
- monorepo 的具体布局（包管理器、构建编排）尚需单独决策。

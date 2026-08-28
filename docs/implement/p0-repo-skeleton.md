# P0：仓库骨架（可执行计划）

| 项 | 内容 |
| --- | --- |
| 预估 | 4h |
| 前置 | 无 |
| 被依赖 | P1、P2，及所有后续阶段的验证基础 |
| 相关决策 | ADR-0020、ADR-0004 |

## 目标

搭起 nest CLI 管理的 monorepo 骨架：`apps/api`（NestJS）、`libs/shared`（@kh 契约库）、`apps/web`（游离 Next.js）、仓库级单一 `package.json`。两端独立启动，web 能编译 `libs/shared` 源码。

## 开工前检查

- [x] Node ≥ 22（当前环境 24）、pnpm 已装
- [x] nest CLI 可用：本地 `@nestjs/cli@11.0.24`（devDep，无需全局安装）

## 步骤

### 1. 仓库基座（P0-1，0.5h）

- 根 `package.json`：`name: knowledge-hub`、`private: true`、`packageManager` 字段钉死 pnpm 版本、`engines` 钉死 Node ≥ 22。
- `.gitignore`：`node_modules/`、`dist/`、`.next/`、`.env`。
- 验证：`pnpm -v` 输出与 `packageManager` 一致。

### 2. nest monorepo 配置（P0-2，0.5h）

- 根 `nest-cli.json`：`monorepo: true`、`defaultLibraryPrefix: "@kh"`（projects 由后续 `nest g` 自动登记）。
- 明确禁止项：不建 `pnpm-workspace.yaml`、不建 `packages/` 目录（ADR-0020）。

### 3. 生成 api（P0-3，0.5h）

- `nest g application api` → 生成 `apps/api`，nest-cli.json 自动注册 projects 与 tsconfig paths。
- 根 package.json 补 api 运行依赖：`@nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs`；dev 依赖：`typescript @nestjs/cli ts-node` 等（以生成为准）。
- 根 scripts：`dev`（nest start --watch）、`build`、`lint`。**脚本只管 api + libs，不碰 apps/web**。
- 验证：根目录 `pnpm dev` 起 api，hello 端点 curl 可通。

### 4. 生成 shared 库（P0-4，0.5h）

- `nest g library shared` → 生成 `libs/shared`，前缀走 `defaultLibraryPrefix` 得 `@kh/shared`。
- 在 shared 放一个占位导出常量。
- 验证：api 中 `import` 该常量，编译通过。

### 5. 生成 web（P0-5，0.5h）

- `cd apps && pnpm dlx create-next-app@latest web --typescript --app --eslint`（样式方案自选，从简）。
- `apps/web` 保留自己的 package.json；**不**注册进 nest-cli.json（游离应用，ADR-0020）。
- 验证：`cd apps/web && pnpm install && pnpm dev`，页面可访问。

### 6. web 引 shared 源码（P0-6，1h）★ 本阶段最大风险项

- `apps/web/tsconfig.json` 的 `compilerOptions.paths` 增加：`"@kh/shared": ["../../libs/shared/src"]`（baseUrl 同步对齐）。
- 编译报错时优先尝试 `next.config` 的 `transpilePackages`。
- 验证：shared 中新增一个常量，web 页面 import 并渲染成功。
- **当天必须打通，打不通即阻塞，不上后续阶段。**

### 7. 收尾（P0-7，0.5h）

- 根 `.env.example` 骨架（变量清单见总览 §6）。
- 检查根 scripts 与 `apps/web` 完全解耦。

## 阶段验证

1. 终端 A：根目录 `pnpm install && pnpm dev` → api 启动。
2. 终端 B：`apps/web` 内 `pnpm install && pnpm dev` → web 启动。
3. 两端互不干扰；`@kh/shared` 两端各引一次均编译通过。

## 完成标准

- [x] 7 个步骤全部完成并通过各自验证
- [x] api、web 可独立启动
- [x] web 引 shared TS 源码编译通过

## 坑位备忘

- nest CLI 版本行为差异：用最新稳定版；生成物结构与 ADR-0020 布局不一致时，以 ADR 为准调整。
- 两摊 install 各自独立（根一摊、apps/web 一摊），别试图合并。

## 实施记录（2026-08-28）

- schematics 11 中 monorepo 应用生成器是 `nest g sub-app`（`application` 生成独立应用到根目录），与计划写法的差异见坑位备忘处理。
- `nest g library` 未从 `defaultLibraryPrefix` 自动取 prefix，需直跑 schematics 命令带 `--prefix=@kh`（nest CLI 11 无此注入逻辑）。
- library 生成器会在 nest-cli.json 顶层写入 `"webpack": true`，导致构建走 webpack 缺 ts-loader；已改回 tsc 构建器（ADR-0020 未涉及 builder，保持 nest 默认）。
- pnpm 11 不再读 package.json 的 `pnpm` 字段，构建脚本许可状态写入仓库级 `pnpm-workspace.yaml`（仅 `allowBuilds` 配置、无 `packages` 字段，不构成 workspace；unrs-resolver 与 sharp 均有预编译产物，构建脚本已拒绝）。
- api 端口默认改为 3001（`PORT ?? 3001`），避免与 web 的 3000 冲突。
- apps/web 由 create-next-app 生成自带 AGENTS.md/CLAUDE.md（next dev 自动维护），保留。

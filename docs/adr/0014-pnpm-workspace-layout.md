# ADR-0014：Monorepo 布局与包管理——pnpm workspace

- 状态：已接受
- 日期：2026-08-28

## 背景

ADR-0004 确定 monorepo，但布局与包管理形态可选 pnpm workspace、Turborepo、NestJS 官方 monorepo 模式。期间曾尝试 nest CLI monorepo 方案（仓库级单一 package.json + libs/*），后撤回。本 ADR 为合并后的最终决策，一次性钉死布局归属、包管理形态、契约载体三点。

## 决策

- **pnpm workspace 管理 monorepo**：根 `pnpm-workspace.yaml` 登记 `apps/*` 与 `packages/*`；`apps/web`、`apps/api`、`packages/shared` 各自持有 package.json；`deploy/` 与 `docs/` 不在 workspace 内。
- **nest CLI 降为应用脚手架**：不采用 NestJS 官方 monorepo 模式（其对 Nest 库友好，但承载 Next.js 应用别扭）；仓库级 `nest-cli.json`（monorepo 模式）与 `libs/` 目录取消。`apps/api` 为 `nest new` 生成的标准 Nest 应用（自带 nest-cli.json，非 monorepo）；api 内部若需共享库，属 api 包内布局，届时单独决策。
- **包管理**：单摊 install——根 `pnpm install` 一次装齐三包；根 `package.json` 统一编排脚本（dev/build/lint 经 `pnpm --filter` 下发，`dev:all` 并发起两端），不引入 Turborepo 等编排层。pnpm 11 的构建脚本许可（allowBuilds）写在 `pnpm-workspace.yaml`。
- **契约载体**：`packages/shared`（包名 `@kh/shared`，见 ADR-0015）；api 与 web 均以 `"@kh/shared": "workspace:*"` 依赖（web 经 next.config `transpilePackages` 消费其构建产物）。
- 新增包时直接在 workspace 内新建目录并登记，无额外配置。

## 后果

- 布局直白、工具链原生；两应用规模下构建编排收益本就可忽略。
- 单一 workspace 协议与单摊 install：两端消费契约方式一致，不再有「api 走别名、web 引源码」的双轨差异。
- 代价：web 侧依赖 transpilePackages 解析 workspace 包；根 scripts 需经 --filter 编排。

# ADR-0021：以 pnpm workspace 管理 monorepo（取代 ADR-0020）

- 状态：已接受
- 日期：2026-08-28

## 背景

ADR-0020 选择由 nest CLI 管理 monorepo（仓库级单一 package.json + libs/*，web 游离、pnpm workspace 取消）。决策人改为以 pnpm workspace 管理 monorepo。连带钉死三点：布局归属、包管理形态、契约载体。

## 决策

- **pnpm workspace 管理 monorepo**：根 `pnpm-workspace.yaml` 登记 `apps/*` 与 `packages/*`；`apps/web`、`apps/api`、`packages/shared` 各自持有 package.json；`deploy/` 与 `docs/` 不在 workspace 内。
- **nest CLI 降为应用脚手架**：仓库级 `nest-cli.json`（monorepo 模式）与 `libs/` 目录取消；`apps/api` 为 `nest new` 生成的标准 Nest 应用（自带 nest-cli.json，非 monorepo）。api 内部若需共享库，属 api 包内布局，届时单独决策。
- **包管理**：单摊 install——根 `pnpm install` 一次装齐三包；根 scripts 经 `pnpm --filter` 编排 dev/build/lint，`dev:all` 并发起两端。pnpm 11 的构建脚本许可（allowBuilds）写在 `pnpm-workspace.yaml`。
- **契约载体**：恢复 ADR-0015 的 `packages/shared`，包名 `@kh/shared`；api 与 web 均以 `"@kh/shared": "workspace:*"` 依赖（web 经 next.config `transpilePackages` 消费其构建产物）。ADR-0015 的实质约束（类型即契约、零框架依赖、不含运行时逻辑）不变。
- 本条**取代 ADR-0020**，**恢复 ADR-0014 布局**，并**恢复 ADR-0015 载体为 packages/shared**。

## 后果

- 单一 workspace 协议与单摊 install：两端消费契约方式一致，不再有「api 走别名、web 引源码」的双轨差异；安装与脚本编排不再分两摊。
- 代价：web 侧依赖 transpilePackages 解析 workspace 包；根 scripts 需经 --filter 编排（P0 已验证的 concurrently dev:all 沿用）。
- P0 需按新布局重执行；原 nest CLI 布局的实施记录作废归档。

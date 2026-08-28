# ADR-0020：以 nest CLI 管理 monorepo（取代 ADR-0014，修订 ADR-0015 载体）

- 状态：已接受
- 日期：2026-08-28

## 背景

ADR-0014 选择 pnpm workspace 作为 monorepo 布局，并拒绝 NestJS 官方 monorepo 模式（理由：承载 Next.js 应用别扭）。决策人要求改为由 nest CLI 管理 monorepo 的具体布局与包管理。变更前已钉死三个连带问题：web 归属、包管理形态、契约包载体。

## 决策

- **nest CLI 管理 monorepo**：根 `nest-cli.json`（`monorepo: true`）注册 projects——`apps/api`（application）与 `libs/*`（libraries，含 `libs/shared`），固化 `defaultLibraryPrefix: "@kh"`；新增 Nest 应用/库一律 `nest generate`。
- **web 游离**：`apps/web` 为独立 Next.js 应用，不在 nest-cli.json 注册，nest CLI 不过问。
- **包管理**：仓库级单一 `package.json` 承载 api+libs 的全部依赖与脚本；`apps/web` 保留自己的 package.json 独立安装。**pnpm workspace 取消**，`packages/` 目录不再存在。
- **契约载体**：ADR-0015 的 `packages/shared` 撤销，改为 **`libs/shared`**（`nest g library shared --prefix @kh`）。api 经 `@kh/shared` 路径别名消费；web 经自身 tsconfig paths 直接引用 libs/shared 源码。ADR-0015 的实质约束（类型即契约、零框架依赖、不含运行时逻辑）不变，仅载体变更。
- 本条**取代 ADR-0014**，并**修订 ADR-0015 的载体部分**。

## 后果

- 回到 NestJS 官方工具链：`nest generate` 自动注册 projects 与 paths，api 侧约定统一。
- ADR-0014 的拒绝理由（承载 Next.js 别扭）以"web 游离、nest 不管"化解；代价是仓库存在两个 package.json，install 与脚本编排需分两摊（根 scripts 编排 api，web 目录内自理）。
- 构建产物为仓库级 dist 镜像树（api 与 libs 统一产出）；web 构建完全独立。

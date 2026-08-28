# P0：仓库骨架（可执行计划）

| 项 | 内容 |
| --- | --- |
| 预估 | 4h |
| 前置 | 无 |
| 被依赖 | P1、P2，及所有后续阶段的验证基础 |
| 相关决策 | ADR-0021、ADR-0015、ADR-0004 |

## 目标

搭起 pnpm workspace 骨架：`apps/web`（Next.js）、`apps/api`（NestJS 标准应用）、`packages/shared`（@kh/shared 契约包）、根统一编排。单一 install，两端独立启动，web 能编译 shared 包。

## 开工前检查

- [ ] Node ≥ 22（当前环境 24）、pnpm 已装
- [ ] 仓库当前仅 docs/，无残留 nest CLI monorepo 产物

## 步骤

### 1. 仓库基座（P0-1，0.5h）

- 根 `package.json`：`name: knowledge-hub`、`private: true`、`packageManager` 字段钉死 pnpm 版本、`engines` 钉死 Node ≥ 22。
- `pnpm-workspace.yaml`：`packages: ["apps/*", "packages/*"]`；pnpm 11 的构建脚本许可（`allowBuilds`）也写在此文件。
- `.gitignore`：`node_modules/`、`dist/`、`.next/`、`.env*`。
- 验证：`pnpm -v` 输出与 `packageManager` 一致；`pnpm install` 成功。

### 2. 生成 api（P0-2，0.5h）

- `apps/api` 以 `nest new` 生成（pnpm 包管理器）：自带 package.json 与 nest-cli.json（标准模式，非 monorepo）。
- api 端口默认 3001（`PORT ?? 3001`），避免与 web 的 3000 冲突。
- 验证：`pnpm --filter api dev` 起 api，hello 端点 curl 可通。

### 3. 生成 shared 包（P0-3，0.5h）

- `packages/shared` 手工建包：`name: @kh/shared`、`private: true`，tsc 构建产物指向 `dist/`（`main`/`types`），src 放占位导出常量。
- 依赖为空（仅 devDeps: typescript），零框架依赖（ADR-0015）。
- 验证：`pnpm --filter @kh/shared build` 产出 dist。

### 4. 生成 web（P0-4，0.5h）

- `apps/web` 由 create-next-app 生成（TypeScript、App Router、ESLint；样式方案自选，从简）。生成物自带 AGENTS.md/CLAUDE.md（next dev 自动维护），保留。
- 验证：`pnpm --filter web dev`，页面可访问。

### 5. 契约接线（P0-5，1h）★ 本阶段最大风险项

- api、web 各自 package.json 加 `"@kh/shared": "workspace:*"`。
- web 侧：`next.config` 加 `transpilePackages: ["@kh/shared"]`（workspace symlink 包默认不被 webpack 转译）。
- 验证：shared 新增一个常量，两端 import 并编译/渲染通过。
- **当天必须打通，打不通即阻塞，不上后续阶段。**

### 6. 根编排（P0-6，0.5h）

- 根 scripts：`dev`（api）、`dev:web`（web）、`dev:all`（concurrently 并发两端，一端退出全终止）、`build`（shared → api → web 按序）、`lint`（`pnpm -r lint`）。
- 验证：根 `pnpm install` 一次装齐三包；`pnpm dev:all` 两端同起。

### 7. 收尾（P0-7，0.5h）

- 根 `.env.example` 骨架（变量清单见 design.md §6）；api 的 `.env` 按其所需子集 cp，web 无环境变量需求则跳过。
- 检查根 scripts 无跨包硬路径依赖。

## 阶段验证

1. 根 `pnpm install` 一次成功（无 apps/web 二次 install）。
2. 根 `pnpm dev:all` → api(3001) 与 web(3000) 同时可访问。
3. `@kh/shared` 两端各引一次均编译通过。

## 完成标准

- [ ] 7 个步骤全部完成并通过各自验证
- [ ] api、web 可独立启动
- [ ] web 经 workspace 依赖编译 shared 包通过

## 坑位备忘

- pnpm 11 不读 package.json 的 `pnpm` 字段；构建脚本许可（allowBuilds）必须写在 pnpm-workspace.yaml（unrs-resolver 与 sharp 有预编译产物，默认拒绝构建脚本，按需放行）。
- nest CLI 版本行为差异：以 `nest new` 最新稳定版生成物为准；与 ADR-0021 布局不一致时以 ADR 为准调整。
- TS 6（IDE 环境侧工具链）会反复写入 `ignoreDeprecations: "6.0"`（legacy decorators 在 TS 6 弃用而 NestJS 依赖之）；治本：项目 TypeScript 升到 6.0.3，并留意 TS 6 对显式 rootDir 的强制要求（以实际编译报错为准）。
- workspace 包被 webpack 忽略是默认行为，web 侧必须显式声明 transpilePackages。
- 全仓只有根一个 install 摊，别在各包内各自 install（会破坏 workspace 单摊约束）。

## 实施记录

### 新布局（ADR-0021）——待执行

- 决策变更后本计划重写，尚未执行；执行后记录偏差于此。

### 历史记录（ADR-0020 nest CLI 布局，已作废）

决策 ADR-0021 取代 ADR-0020 后，以下按 nest CLI monorepo 执行的记录作废归档，仍有效的经验已移入坑位备忘：

- schematics 11 中 monorepo 应用生成器是 `nest g sub-app`（`application` 生成独立应用到根目录），与计划写法的差异见坑位备忘处理。
- `nest g library` 未从 `defaultLibraryPrefix` 自动取 prefix，需直跑 schematics 命令带 `--prefix=@kh`（nest CLI 11 无此注入逻辑）。
- library 生成器会在 nest-cli.json 顶层写入 `"webpack": true`，导致构建走 webpack 缺 ts-loader；已改回 tsc 构建器（ADR-0020 未涉及 builder，保持 nest 默认）。
- pnpm 11 不再读 package.json 的 `pnpm` 字段，构建脚本许可状态写入仓库级 `pnpm-workspace.yaml`（仅 `allowBuilds` 配置、无 `packages` 字段，不构成 workspace；unrs-resolver 与 sharp 均有预编译产物，构建脚本已拒绝）。
- api 端口默认改为 3001（`PORT ?? 3001`），避免与 web 的 3000 冲突。
- apps/web 由 create-next-app 生成自带 AGENTS.md/CLAUDE.md（next dev 自动维护），保留。
- spec 文件（被 tsconfig.app.json 的 `**/*spec.ts` 排除在构建外）在 IDE 中报 ts(2593) describe 未定义：根 tsconfig 原本无 include/exclude，IDE 会把 spec 归入无类型上下文的推断项目。修复：根 tsconfig 显式 `include: ["apps/**/*", "libs/**/*"]` + `exclude: ["apps/web", ...]` + `types: ["jest", "node", "supertest"]`，让 spec 确定性地归属根项目并显式拿到 jest 类型（tsserver 验证 diagnostics 为空）。构建项目（tsconfig.app.json / tsconfig.lib.json）语义不变。
- `"ignoreDeprecations": "6.0"` 会被环境侧（IDE 的 TS 6+ 工具链）自动写入 tsconfig——legacy decorators 在 TS 6 弃用而 NestJS 依赖之，写入会反复发生。治本：项目 TypeScript 升级到 6.0.3，该键转为合法值。TS 6 连带修复：tsconfig.app.json 加 `rootDir: "../.."`、tsconfig.lib.json 加 `rootDir: "src"`（TS 6 强制显式 rootDir）；根 tsconfig 开 `esModuleInterop`，e2e 的 supertest 改默认导入。
- 新增根脚本 `dev:all`（concurrently）：同时启动 api 与 web 开发服务器，一端退出则全部终止。`dev/build/lint` 仍只面向 api+libs，与 web 解耦不变。

# P0：仓库骨架（可执行计划）

| 项 | 内容 |
| --- | --- |
| 状态 | ✅ 已完成（2026-08-28，见实施记录） |
| 预估 | 4h |
| 前置 | 无 |
| 被依赖 | P1、P2，及所有后续阶段的验证基础 |
| 相关决策 | ADR-0014、ADR-0015、ADR-0004 |

## 目标

搭起 pnpm workspace 骨架：`apps/web`（Next.js）、`apps/api`（NestJS 标准应用）、`packages/shared`（@kh/shared 契约包）、根统一编排。单一 install，两端独立启动，web 能编译 shared 包。

## 开工前检查

- [x] Node ≥ 22（当前环境 24）、pnpm 已装
- [x] 仓库当前仅 docs/，无残留 nest CLI monorepo 产物

## 步骤

### 1. 仓库基座（P0-1，0.5h）

- 根 `package.json`：`name: knowledge-hub`、`private: true`、`packageManager` 字段钉死 pnpm 版本、`engines` 钉死 Node ≥ 22。
- `pnpm-workspace.yaml`：`packages: ["apps/*", "packages/*"]`；pnpm 11 的构建脚本许可（`allowBuilds`）也写在此文件。
- `.gitignore`：`node_modules/`、`dist/`、`.next/`、`.env*`。
- 验证：`pnpm -v` 输出与 `packageManager` 一致；`pnpm install` 成功。

### 2. 生成 api（P0-2，0.5h）

- `apps/api` 以 `nest new` 生成（pnpm 包管理器）：自带 package.json 与 nest-cli.json（标准模式，非 monorepo）。
- api 端口默认 8001（`PORT ?? 8001`），web 固定 8000（dev/start 脚本 `-p 8000`），避开其他本地项目的 3000/3001。
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

- 根 scripts：`dev`（api）、`dev:web`（web）、`dev:all`（`pnpm -r --parallel dev` 并发两端）、`build`（shared → api → web 按序）、`lint`（`pnpm -r lint`）。
- 验证：根 `pnpm install` 一次装齐三包；`pnpm dev:all` 两端同起。

### 7. 收尾（P0-7，0.5h）

- 根 `.env.example` 骨架（变量清单见 design.md §6）；api 的 `.env` 按其所需子集 cp，web 无环境变量需求则跳过。
- 检查根 scripts 无跨包硬路径依赖。

## 阶段验证

1. 根 `pnpm install` 一次成功（无 apps/web 二次 install）。
2. 根 `pnpm dev:all` → api(8001) 与 web(8000) 同时可访问。
3. `@kh/shared` 两端各引一次均编译通过。

## 完成标准

- [x] 7 个步骤全部完成并通过各自验证
- [x] api、web 可独立启动
- [x] web 经 workspace 依赖编译 shared 包通过

## 坑位备忘

- pnpm 11 不读 package.json 的 `pnpm` 字段；构建脚本许可（allowBuilds）必须写在 pnpm-workspace.yaml（unrs-resolver 与 sharp 有预编译产物，默认拒绝构建脚本，按需放行）。**且 pnpm 11.24 的 `allowBuilds` 是 map 格式（`包名: true`）**：写成列表会被 pnpm 自动重写为 `'0'/'1'` 键并继续 ERR_PNPM_IGNORED_BUILDS。
- nest CLI 版本行为差异：以 `nest new` 最新稳定版生成物为准；与 ADR-0014 布局不一致时以 ADR 为准调整。
- TS 6（IDE 环境侧工具链）会反复写入 `ignoreDeprecations: "6.0"`（legacy decorators 在 TS 6 弃用而 NestJS 依赖之）；治本：项目 TypeScript 升到 6.0.3，并留意 TS 6 对显式 rootDir 的强制要求（以实际编译报错为准）。
- TS 6 起 `types` 默认空数组，@types 包不再自动发现：@types/node 必须显式进 `types` 列表，否则 `process` 报 TS2591。
- TS 6 增量编译（incremental）与 nest `deleteOutDir` 冲突：tsbuildinfo 新鲜时 tsc 跳过 emit，而 nest 每次 dev/start 先删 dist，导致 `MODULE_NOT_FOUND dist/main`。api 已移除 `incremental`。
- Next 16（Turbopack-only）自动转译 workspace 包，`transpilePackages` 仅 webpack/Pages Router 场景需要——App Router 下无需声明（以两端实际编译验证为准）。
- create-next-app 会在应用目录内生成 `pnpm-workspace.yaml`（构建脚本豁免声明），与根 workspace 冲突，需删除。
- 全仓只有根一个 install 摊，别在各包内各自 install（会破坏 workspace 单摊约束）。

## 实施记录

### 新布局（ADR-0014）——已执行（2026-08-28）

- P0-1：根 package.json（packageManager pnpm@11.24.0、engines node>=22）、pnpm-workspace.yaml、.gitignore 建立；根 install 一次通过。`allowBuilds` 按 map 格式写入（坑位备忘已更新）。
- P0-2：nest CLI 11 标准模式生成 apps/api。端口最终定为 api 8001（`PORT ?? 8001`）、web 8000（dev/start 脚本 `-p 8000`）——初版 3000/3001 与本地另一项目 shiguang 撞端口，后按决策改为 8000/8001。偏差一：`--skip-git` 会连带不生成 .gitignore（根 .gitignore 已覆盖 node_modules/dist/.env*，另补了 coverage/）。偏差二：nest 11 生成物无 `dev` 脚本（仅 start:dev），按计划验证需要补了 `dev: nest start --watch` 别名。
- P0-2（TS 6.0.3 治本落地）：按坑位备忘把 api 的 TypeScript 升到 6.0.3，实际报错三处并已修复：TS5011 → tsconfig.build.json 显式 `rootDir: "./src"`；TS5101（baseUrl 弃用）→ tsconfig.json 加 `ignoreDeprecations: "6.0"`（该键在 6.0.3 为合法值）；TS2591 → TS 6 起 `types` 默认空数组，显式 `types: ["node", "jest", "supertest"]`。此外基础 tsconfig.json 也需显式 `rootDir: "."`（ts-jest 走基础配置做内存 emit，同样触发 TS5011；取值必须覆盖 src+test 两目录，构建配置以 `./src` 覆盖不受影响）。
- P0-2 新坑：TS 6 incremental + nest deleteOutDir 组合导致 emit 被跳过（dev 启动即 `MODULE_NOT_FOUND dist/main`），已移除 tsconfig.json 的 `incremental`（详见坑位备忘）。
- P0-3：@kh/shared 手工建包（nodenext 模块、零框架依赖、仅 devDeps typescript、tsc 产出 dist/）；build 验证通过。
- P0-4：create-next-app 16.3.3 生成 apps/web（Next 16.3.3 / React 19.2.8 / TS 5 / ESLint flat / 纯 CSS）；AGENTS.md/CLAUDE.md 保留。偏差：create-next-app 在 apps/web 内生成 `pnpm-workspace.yaml`（allowBuilds 豁免声明），与根 workspace 冲突，已删除，放行统一由根文件管理。
- P0-5：api、web 各加 `@kh/shared: workspace:*`；shared 新增 `APP_NAME` 常量，api hello 返回与 web 首页渲染均已验证（spec 断言同步更新）。偏差：Next 16 官方文档确认 Turbopack 自动转译 workspace 包，`transpilePackages` 仅 webpack/Pages Router 需要——未加，以两端实际编译+渲染为准。注意：React SSR 会在 JSX 文本插值处插入 `<!-- -->` 注释节点，grep 页面 HTML 验证时按此匹配。
- P0-6：根 scripts dev/dev:web/dev:all/build/lint 完成；`pnpm build` 按序 shared→api→web 通过。dev:all 初版为 concurrently -k（级联终止实测生效），后按决策改为 `pnpm -r --parallel dev`：放弃"一端退出全终止"语义（pnpm 对已运行兄弟进程无清理契约），换取零额外依赖与更短编排；concurrently 已移除。lint：`pnpm -r lint` 覆盖 3/4 包（shared 无 lint 脚本自动跳过）；api 模板代码有 1 个 no-floating-promises warning（generator 自带，未处理）。
- P0-7：根 .env.example 按 design.md §6 变量清单建立；api 按其子集 cp 出 .env（`git check-ignore` 确认 .env 被忽略、.env.example 经否定规则可跟踪）；根 scripts 仅用 `--filter` 无跨包硬路径。

### 历史记录（nest CLI monorepo 布局，已作废）

决策改回 pnpm workspace 后，以下按 nest CLI monorepo 执行的记录作废归档，仍有效的经验已移入坑位备忘：

- schematics 11 中 monorepo 应用生成器是 `nest g sub-app`（`application` 生成独立应用到根目录），与计划写法的差异见坑位备忘处理。
- `nest g library` 未从 `defaultLibraryPrefix` 自动取 prefix，需直跑 schematics 命令带 `--prefix=@kh`（nest CLI 11 无此注入逻辑）。
- library 生成器会在 nest-cli.json 顶层写入 `"webpack": true`，导致构建走 webpack 缺 ts-loader；已改回 tsc 构建器（决策未涉及 builder，保持 nest 默认）。
- pnpm 11 不再读 package.json 的 `pnpm` 字段，构建脚本许可状态写入仓库级 `pnpm-workspace.yaml`（仅 `allowBuilds` 配置、无 `packages` 字段，不构成 workspace；unrs-resolver 与 sharp 均有预编译产物，构建脚本已拒绝）。
- api 端口默认改为 3001（`PORT ?? 3001`），避免与 web 的 3000 冲突。
- apps/web 由 create-next-app 生成自带 AGENTS.md/CLAUDE.md（next dev 自动维护），保留。
- spec 文件（被 tsconfig.app.json 的 `**/*spec.ts` 排除在构建外）在 IDE 中报 ts(2593) describe 未定义：根 tsconfig 原本无 include/exclude，IDE 会把 spec 归入无类型上下文的推断项目。修复：根 tsconfig 显式 `include: ["apps/**/*", "libs/**/*"]` + `exclude: ["apps/web", ...]` + `types: ["jest", "node", "supertest"]`，让 spec 确定性地归属根项目并显式拿到 jest 类型（tsserver 验证 diagnostics 为空）。构建项目（tsconfig.app.json / tsconfig.lib.json）语义不变。
- `"ignoreDeprecations": "6.0"` 会被环境侧（IDE 的 TS 6+ 工具链）自动写入 tsconfig——legacy decorators 在 TS 6 弃用而 NestJS 依赖之，写入会反复发生。治本：项目 TypeScript 升级到 6.0.3，该键转为合法值。TS 6 连带修复：tsconfig.app.json 加 `rootDir: "../.."`、tsconfig.lib.json 加 `rootDir: "src"`（TS 6 强制显式 rootDir）；根 tsconfig 开 `esModuleInterop`，e2e 的 supertest 改默认导入。
- 新增根脚本 `dev:all`（concurrently）：同时启动 api 与 web 开发服务器，一端退出则全部终止。`dev/build/lint` 仍只面向 api+libs，与 web 解耦不变。

# P7：边界强制与验收（可执行计划）

| 项 | 内容 |
| --- | --- |
| 预估 | 7h |
| 前置 | P0–P6 全部完成 |
| 被依赖 | —（MVP 收尾） |
| 相关决策 | ADR-0007、ADR-0019 |

## 目标

用 ESLint 把架构边界变成机器可执行的约束；全仓 lint + build 全绿；验收剧本逐项通过；README 让新人可冷启动。

## 步骤

### 1. ESLint：LangChain 边界（P7-1，1.5h）

- 规则：api 内**非 `src/ingest/`、`src/retrieval/`** 的文件禁止导入 `langchain`、`@langchain/*` 系包。
- 实现：`eslint-plugin-boundaries` 或 `no-restricted-imports`（overrides 按目录生效），示例：
  ```jsonc
  {
    "files": ["apps/api/src/**/!(*ingest*|*retrieval*)/**/*.ts"],
    "rules": {
      "no-restricted-imports": ["error", { "patterns": ["langchain*", "@langchain/*"] }]
    }
  }
  ```
  （glob 写法以实际 lint 通过为准，目的不变。）
- 验证：在 `documents/` 或 `chat/` 故意写一行 langchain import → lint 报错。

### 2. ESLint：前后端隔离（P7-2，1h）

- web 禁止导入 api 服务端代码（`packages/shared`（@kh/shared）类型契约除外）。
- 验证：故意越界 import 被拦截。

### 3. 全绿（P7-3，0.5h）

- 根 `pnpm -r lint` 与 `pnpm -r build` 全绿（api、web、shared 三包）。

### 4. 验收执行（P7-4，3h）

逐项执行并记录结果（全过才算 MVP 完成，ADR-0019 不另设评估）：

- [ ] 4.1 `docker compose up` 起 postgres + mongo；根 `pnpm install && pnpm dev:all` 同起 api 与 web，全链路联通
- [ ] 4.2 上传 3 篇 MD，其中 1 篇 >2MB 被明确拒绝
- [ ] 4.3 文档列表正确显示状态（ready / failed）
- [ ] 4.4 提问 → SSE 流式答案 + 文档级引用
- [ ] 4.5 多轮追问（历史由前端携带）
- [ ] 4.6 删除某文档后，相同提问不再引用它

### 5. README（P7-5，1h）

- 快速开始：`docker compose up -d` → 根 `pnpm install` → `pnpm dev:all`。
- 环境变量说明（照 `.env.example`）、已知限制（单用户、无会话持久化、60s 摄取超时等）。
- 按 README 从零冷启动一遍验证。

## 完成标准

- [ ] 两条边界规则生效且被故意违规验证过
- [ ] 全仓 lint + build 全绿
- [ ] 验收 6 项全部通过并有记录
- [ ] README 冷启动成功

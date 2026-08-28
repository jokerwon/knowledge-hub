# ADR-0015：前后端契约——packages/shared 类型包

- 状态：已接受（载体曾由 ADR-0020 修订为 libs/shared，ADR-0021 恢复为 packages/shared）
- 日期：2026-08-28

## 背景

前后端共享 DTO 契约可选 shared 类型包、OpenAPI codegen、或各写各的。

## 决策

- `packages/shared` 存放请求/响应 DTO 的 **TypeScript 类型、枚举与常量**（如文档状态、SSE 事件类型），web 与 api 双向引用。
- shared 包只含类型与纯常量，**不含运行时逻辑、不依赖 NestJS/Next.js**，保持零框架耦合。
- 类型即契约：契约变更导致任一端编译报错即为强制同步机制，不引入 OpenAPI 生成链路。

## 后果

- 契约漂移在编译期暴露，联调成本最低。
- SSE 事件结构等关键契约的单一事实来源在 shared 包内。

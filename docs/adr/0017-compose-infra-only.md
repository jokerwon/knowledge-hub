# ADR-0017：docker-compose 仅含基础设施，应用宿主机运行（修订 ADR-0003）

- 状态：已接受
- 日期：2026-08-28

## 背景

ADR-0003 称"全部服务通过一条 docker-compose 拉起"，其中"全部依赖"含义未钉死：是否包含 api/web 应用本身？第 5 轮拷问明确为不包含。

## 决策

- `docker-compose` **只含基础设施**：PostgreSQL（含 pgvector）与 MongoDB 两个服务。
- api 与 web **永远在宿主机以 pnpm dev 运行**，获得热更新与最短调试链路；不为应用编写 Dockerfile。
- 本条**部分修订 ADR-0003**：该 ADR 中"一条 compose 拉起全部依赖"的范围限定为基础设施依赖。

## 后果

- 演示与开发同一形态：compose 起 infra → pnpm dev 起应用。
- 无应用镜像构建维护成本；代价是"一条命令起完整系统"的演示能力不存在，新环境需 pnpm install + dev。

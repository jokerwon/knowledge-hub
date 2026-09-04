# knowledge-hub

## 依赖服务

不要在本地跑 Docker（或其他方式）自建依赖服务。使用已经可用的远程服务：PostgreSQL 见根目录 `.env` 的 `DATABASE_URL`（e2e 测试库用 `TEST_DATABASE_URL`）。`deploy/docker-compose.yml` 仅供服务器部署参考。

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues on `jokerwon/knowledge-hub`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

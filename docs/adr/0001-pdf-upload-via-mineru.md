# ADR 0001: PDF 上传经 MinerU 云 API 异步摄取

- 状态：已接受
- 日期：2026-09-04
- 背景工单：支持上传 PDF 文件

## 上下文

现状：`POST /documents` 仅接受 .md/.txt（≤ 2 MiB），同步摄取——`buffer.toString('utf8')` 直读后单次 INSERT，响应即最终结果，无中间态，「崩溃即无行」。multer 内存存储，扩展名白名单校验。

PDF 是二进制格式，直读不可行，必须引入解析能力。设计经五轮拷问收敛，关键转折：最初按本地库（unpdf）提取文本层的假设，在决定**使用 MinerU API** 后被推翻，同步模型随之转为异步。

## 决策

1. **解析走 MinerU 官方云 API**，不用本地库。MinerU 输出 markdown，自带 OCR。
   - 理由：扫描件/复杂版式（表格、公式）的解析质量远胜纯文本层提取。
   - 取舍：引入外部依赖、API token 管理、按量成本；文档内容出内网。
2. **接受扫描件**。MinerU 的 OCR 能力正是选型理由，拒绝扫描件等于自费武功。（推翻拷问第一轮的「扫描件拒绝」，该决策基于 unpdf 假设。）
3. **统一异步摄取**。所有类型（含 md/txt）：`POST /documents` → 202 + `status='processing'`；后台完成后置 `ready` / `failed`。
   - 推翻「保持同步」与「md/txt 保持同步」：同一端点两种响应语义的分叉契约更差；md/txt 本地提取快，首次轮询即 ready，体验无损。
   - 前端在列表存在 processing 文档时轮询 `GET /documents`。
4. **失败落库带原因**。新增 `status='failed'` 与 `failure_reason` 列，列表可见、可删除后重传。（推翻「同步 400 不落库」，异步模型下中间态必然存在。）
   - 仍保留的 400 类失败（上传时同步可判定）：缺 file 字段、扩展名拒绝、魔数不符、大小超限。
5. **进程内轮询 + 启动恢复**，不引入 Redis/任务队列。
   - 轮询循环在 API 进程内跑；启动时扫描 `processing` 文档恢复轮询。
   - 行内保存 `mineru_task_id` 以支持恢复。
   - 已知限制：多实例部署会重复轮询；当前单实例部署，可接受。
6. **15 分钟总超时，不自动重试**。超时置 failed（原因：解析超时）。失败多为文件本身问题，自动重试白白消耗 MinerU 配额；用户删除后重新上传。
7. **限制分层**：
   - md/txt：维持 2 MiB（`UPLOAD_MAX_BYTES`）。
   - PDF：20 MiB（新增 `UPLOAD_PDF_MAX_BYTES`，默认 20 MiB）。multer 上限按 PDF 值设，md/txt 超限在服务层判定后 400。
   - 页数上限 100 页（`PDF_MAX_PAGES`），超出置 failed。
8. **类型校验：扩展名 + 魔数嗅探**。白名单加 `.pdf`；PDF 校验 `%PDF-` 文件头，md/txt 校验 UTF-8 可解码。拦截改后缀伪装/传错文件。
9. **标题仍取文件名**（剥离 `.pdf` 后缀）。PDF 元数据 title 经常为空或为垃圾值（如「Microsoft Word - xxx.doc」），不可信。
10. **MinerU 结果只取 markdown 文本**，丢弃提取的图片资源。content 列保持纯文本契约。

## 后果

正面：
- 扫描件、复杂版式 PDF 可用；摄取质量高。
- 统一状态机（processing → ready/failed），前后端一套契约。
- 无新基础设施（不用 Redis/队列），部署形态不变（postgres + api + web）。

负面/风险：
- **文档内容出内网至 MinerU 云**：已接受的合规风险。若未来有敏感文档需求，需再评估自部署 MinerU（镜像数 GB，GPU 更佳）。
- 引入中间态与 failed 残留，需要失败原因的展示与清理路径。
- MinerU 可用性/配额成为摄取链路瓶颈；进程内并发上限定为 3 个在飞任务，超出排队。
- 进程崩溃后靠启动恢复续轮询；MinerU 侧任务若在崩溃间隙完成，恢复时一次性收敛。

## 实现注记

- 环境变量：`MINERU_API_TOKEN`（必填）、`MINERU_API_BASE`（默认官方端点）、`UPLOAD_PDF_MAX_BYTES`、`PDF_MAX_PAGES`。
- 共享常量入 `@kh/shared`：`DEFAULT_PDF_MAX_UPLOAD_BYTES`、`DEFAULT_PDF_MAX_PAGES`；`DocumentStatus` 扩为 `'processing' | 'ready' | 'failed'`，`DocumentDto` 增加 `failure_reason`。
- DB migration：`documents` 表加 `failure_reason`（nullable text）、`mineru_task_id`（nullable text）。
- MinerU Open API 为任务制（创建任务 → 轮询 → 下载 markdown 结果）；确切端点与响应结构以实现时官方文档为准。
- 前端：上传对话框 accept 增加 `.pdf`，按类型显示上限文案；列表轮询（存在 processing 时）；failed 行展示原因并允许删除。

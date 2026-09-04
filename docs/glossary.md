# 术语表（Ubiquitous Language）

## 文档摄取

- **文档（Document）**：知识库中的一条记录，含 `id` / `title` / `content` / `status` / `created_at`。契约不对外暴露 `content`。
- **摄取（Ingestion）**：从上传文件到文档 `ready` 的完整过程。ADR 0001 起为异步：`POST /documents` → 202 → 后台处理。
- **标题（Title）**：取自上传文件名，剥离扩展名（`.md` / `.txt` / `.pdf`）。不使用文件内部元数据。

## 状态机

- **processing**：已受理，等待/正在进行解析。进程重启后由启动恢复继续轮询。
- **ready**：摄取完成，内容可用。
- **failed**：摄取失败，`failure_reason` 记录原因（解析失败、加密、页数超限、超时等）。列表可见，可删除后重传。

## 解析

- **MinerU**：第三方 PDF 解析云服务（官方 Open API，任务制：创建 → 轮询 → 取 markdown 结果）。PDF 的唯一解析路径；自带 OCR。
- **文本层（Text Layer）**：数字原生 PDF 内嵌的可提取文本。区别于扫描图像。
- **扫描件（Scanned PDF）**：无文本层的图片型 PDF，需 OCR。ADR 0001 起接受（经 MinerU OCR）。
- **魔数嗅探（Magic-Bytes Sniffing）**：校验文件头字节（PDF 为 `%PDF-`），在扩展名白名单之外的第二道类型校验。

## 限制

- **UPLOAD_MAX_BYTES**：md/txt 大小上限，默认 2 MiB。
- **UPLOAD_PDF_MAX_BYTES**：PDF 大小上限，默认 20 MiB。
- **PDF_MAX_PAGES**：PDF 页数上限，默认 100 页。
- **解析超时**：自提交 MinerU 起 15 分钟，超时置 `failed`，不自动重试。

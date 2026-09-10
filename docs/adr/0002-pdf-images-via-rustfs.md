# ADR 0002: PDF 图片资源上传 RustFS 并改写 Markdown 引用

- 状态：已接受
- 日期：2026-09-09
- 背景：PDF 摄取保留 MinerU 解析结果中的图片资源

## 上下文

ADR 0001 规定 MinerU 结果只取 `full.md`，丢弃结果 ZIP 内的图片资源。现需在解析 PDF 时保留这些图片。仓库原有部署没有对象存储，因此 RustFS 是新增的 S3 兼容依赖。

## 决策

1. 仅处理 PDF 经 MinerU 结果 ZIP 产出的图片；不下载 Markdown 外链，也不改变 md/txt 摄取。
2. 图片上传 RustFS S3 兼容服务。配置项为 `RUSTFS_ENABLED`、`RUSTFS_ENDPOINT`、`RUSTFS_PUBLIC_URL`、`RUSTFS_ACCESS_KEY`、`RUSTFS_SECRET_KEY`、`RUSTFS_BUCKET`、`RUSTFS_REGION`。
3. `full.md` 中的图片引用改写为 `RUSTFS_PUBLIC_URL/bucket/key`，供前端直接访问；不新增 API 图片代理。
4. 对象 key 为 `documents/{docId}/{序号}-{安全文件名}`。序号按 ZIP 中图片条目出现顺序递增；文件名仅保留安全 basename 和受支持的扩展名。
5. 图片上传失败、RustFS 未启用或 Markdown 引用对应资源缺失，整篇 PDF 摄取失败，不生成 ready 文档和不完整图片引用。
6. 应用在首次上传图片前检查 bucket；不存在时通过 S3 `CreateBucket` 自动创建。凭据必须具备 `HeadBucket`、`CreateBucket`、`PutObject` 和 `PutBucketPolicy` 权限。
7. 图片对象使用 ZIP 条目推断的 `Content-Type`；不信任 ZIP 内路径作为对象 key，且拒绝目录条目和未知扩展名图片。

## 后果

正面：图片与正文解耦，数据库不膨胀；ready 文档引用稳定的 RustFS 公网 URL；按文档前缀隔离对象，避免同名覆盖。

负面：新增 RustFS 配置和部署依赖；公网 URL 暴露对象，访问控制交由 RustFS/bucket 策略负责；文档软删除不立即回收对象，与现有回收站语义一致，永久清理时需同步删除对应前缀。

## 实现注记

- 使用 AWS SDK S3 client，兼容 RustFS。
- `RUSTFS_ENABLED=false` 时，含图片的 PDF 不能成功摄取；无图片结果仍可完成。
- bucket 检查/创建只在本进程首次上传图片时执行，并发上传共享同一个初始化 Promise。
- bucket 创建后自动设置匿名 `s3:GetObject` 策略（限定 `documents/*` 前缀），保证改写后的公网 URL 可直接访问；已存在策略不覆盖。
- URL 统一去尾部斜杠，key 使用 URL 编码逐段拼接。
- API 测试默认关闭 RustFS，并通过 fake S3/客户端边界覆盖图片上传与引用改写。

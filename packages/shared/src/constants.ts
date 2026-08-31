// 共享常量：默认值与 .env 默认保持一致。
// 业务代码通过常量引用，避免两侧硬编码漂移。

export const APP_NAME = 'knowledge-hub';

export const DEFAULT_MAX_UPLOAD_BYTES = 2_097_152; // 2 MiB
export const DEFAULT_INGEST_TIMEOUT_MS = 60_000;
export const DEFAULT_EMBEDDING_DIM = 768;

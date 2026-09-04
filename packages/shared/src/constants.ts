// 共享常量：默认值与 .env 默认保持一致。
// 业务代码通过常量引用，避免两侧硬编码漂移。

export const DEFAULT_MAX_UPLOAD_BYTES = 2_097_152; // 2 MiB

// PDF 档限制（ADR 0001 决策 7）：与 .env 默认保持一致。
export const DEFAULT_PDF_MAX_UPLOAD_BYTES = 20_971_520; // 20 MiB
export const DEFAULT_PDF_MAX_PAGES = 100;

export class IngestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`摄取超时（${timeoutMs}ms），文档已标记为 failed`);
    this.name = 'IngestTimeoutError';
  }
}

export class EmbeddingDimensionError extends Error {
  constructor(actual: number, expected: number) {
    super(
      `Embedding 维度不符：网关返回 ${actual} 维，数据库列为 ${expected} 维（EMBEDDING_DIM）。` +
        '换模型/维度需新迁移并重传文档（ADR-0012）。',
    );
    this.name = 'EmbeddingDimensionError';
  }
}

export class EmbeddingConfigError extends Error {
  constructor() {
    super(
      'Embedding 网关未配置：请在 .env 设置 EMBED_BASE_URL 与 EMBED_MODEL（见 ADR-0007）',
    );
    this.name = 'EmbeddingConfigError';
  }
}

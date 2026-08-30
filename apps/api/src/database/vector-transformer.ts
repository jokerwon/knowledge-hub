// pgvector 列的自定义序列化：实体侧 number[] ↔ 数据库 "[0.1,0.2,...]" 字符串。
// TypeORM 对 vector 类型无原生支持，此处是社区惯用做法（ADR-0016）。
import type { ValueTransformer } from 'typeorm';

// 维度由 .env 的 EMBEDDING_DIM 决定（默认 768）；migration 与 entity 都从此处读取，保持一致。
// 换维度需新迁移 + 文档重传（ADR-0012）。
export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM) || 768;

export const vectorTransformer: ValueTransformer = {
  to: (value: number[] | null | undefined): string | null => {
    if (value == null) return null;
    return `[${value.join(',')}]`;
  },
  from: (value: string | null | undefined): number[] | null => {
    if (value == null) return null;
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((s) => Number(s));
  },
};

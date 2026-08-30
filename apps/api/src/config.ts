import * as dotenv from 'dotenv';
import * as path from 'node:path';
import {
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_INGEST_TIMEOUT_MS,
  DEFAULT_MAX_UPLOAD_BYTES,
} from '@kh/shared';

// 加载 monorepo 根的 .env（与 database/data-source.ts 同一约定）；
// pnpm 脚本的 CWD 为 apps/api，上溯 2 级到仓库根。
dotenv.config({ path: path.resolve(process.cwd(), '..', '..', '.env') });

const int = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  uploadMaxBytes: int(process.env.UPLOAD_MAX_BYTES, DEFAULT_MAX_UPLOAD_BYTES),
  chunkSize: int(process.env.CHUNK_SIZE, DEFAULT_CHUNK_SIZE),
  chunkOverlap: int(process.env.CHUNK_OVERLAP, DEFAULT_CHUNK_OVERLAP),
  ingestTimeoutMs: int(
    process.env.INGEST_TIMEOUT_MS,
    DEFAULT_INGEST_TIMEOUT_MS,
  ),
  embeddingDim: int(process.env.EMBEDDING_DIM, 768),
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? '',
    apiKey: process.env.LLM_API_KEY ?? '',
    embedModel: process.env.LLM_EMBED_MODEL ?? '',
    chatModel: process.env.LLM_CHAT_MODEL ?? '',
  },
};

// 单用户起步（ADR-0002）：user_id 的唯一来源，当前恒为 null，
// 未来补认证后只改这一处。业务代码禁止再出现其它 user 假设。
export const CURRENT_USER_ID: string | null = null;

// LangChain 边界 ②：向量化。经内部网关（OpenAI 兼容）调用（ADR-0007）。
// @langchain/openai v1 的 embedDocuments 会对所有批次 Promise.all 全并发，
// 因此这里自建小并发池：每批一次请求，最多 EMBED_MAX_CONCURRENCY 个并发请求。
import { OpenAIEmbeddings } from '@langchain/openai';
import type { AppConfig } from '../config';
import {
  EmbeddingConfigError,
  EmbeddingDimensionError,
  IngestTimeoutError,
} from './errors';

const EMBED_BATCH_SIZE = 16;
const EMBED_MAX_CONCURRENCY = 4;

export function createEmbeddings(config: AppConfig): OpenAIEmbeddings {
  const { baseUrl, apiKey, model } = config.embed;
  if (!baseUrl || !model) {
    throw new EmbeddingConfigError();
  }
  return new OpenAIEmbeddings({
    // 内部网关可能不校验密钥，但 OpenAI SDK 要求非空。
    apiKey: apiKey || 'no-api-key',
    model,
    configuration: { baseURL: baseUrl },
    batchSize: EMBED_BATCH_SIZE,
    // 单请求护栏：与请求级超时对齐，避免挂死（配合编排层 Promise.race）。
    timeout: config.ingestTimeoutMs,
  });
}

export async function embedTexts(
  config: AppConfig,
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = createEmbeddings(config);
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    batches.push(texts.slice(i, i + EMBED_BATCH_SIZE));
  }

  const results: number[][] = new Array<number[]>(texts.length);
  let cursor = 0;
  const workerCount = Math.min(EMBED_MAX_CONCURRENCY, batches.length);
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      if (signal?.aborted) {
        throw new IngestTimeoutError(config.ingestTimeoutMs);
      }
      const index = cursor;
      cursor += 1;
      if (index >= batches.length) return;
      const vectors = await client.embedDocuments(batches[index]);
      for (let j = 0; j < vectors.length; j += 1) {
        results[index * EMBED_BATCH_SIZE + j] = vectors[j];
      }
    }
  });
  await Promise.all(workers);

  const dim = config.embeddingDim;
  for (const vector of results) {
    if (vector.length !== dim) {
      throw new EmbeddingDimensionError(vector.length, dim);
    }
  }
  return results;
}

import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { ChunkEntity } from '../documents/entities/chunk.entity';
import { APP_CONFIG, type AppConfig } from '../config';
import { EMBEDDING_DIM } from '../database/vector-transformer';
import { IngestTimeoutError } from './errors';

// 摄取管线：切分 → 向量化 → chunks 批量落库（ADR-0012 / ADR-0007）。
// documents 行与 Mongo 正文的生命周期由 documents 服务负责，这里只做管线本身。
@Injectable()
export class IngestService {
  constructor(
    @InjectRepository(ChunkEntity)
    private readonly chunksRepo: Repository<ChunkEntity>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async ingestDocument(
    documentId: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<number> {
    this.assertNotTimedOut(signal);
    // ponytail: 暂跳过切分与向量化（splitContent / embedTexts 均未调用），
    // 整篇正文作为一个 chunk、embedding 零向量占位；恢复时改回管线并重传文档。
    const texts = [content];
    const embeddings = [new Array<number>(EMBEDDING_DIM).fill(0)];

    this.assertNotTimedOut(signal);
    const chunks = texts.map((text, seq) => ({
      id: randomUUID(),
      documentId,
      seq,
      content: text,
      embedding: embeddings[seq],
    }));
    if (chunks.length > 0) {
      await this.chunksRepo.save(chunks);
    }
    return chunks.length;
  }

  private assertNotTimedOut(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new IngestTimeoutError(this.config.ingestTimeoutMs);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { ChunkEntity } from '../database/entities/chunk.entity';
import { config } from '../config';
import { embedTexts } from './embeddings-client';
import { IngestTimeoutError } from './errors';
import { splitContent } from './text-splitter';

// 摄取管线：切分 → 向量化 → chunks 批量落库（ADR-0012 / ADR-0007）。
// documents 行与 Mongo 正文的生命周期由 documents 服务负责，这里只做管线本身。
@Injectable()
export class IngestService {
  constructor(
    @InjectRepository(ChunkEntity)
    private readonly chunksRepo: Repository<ChunkEntity>,
  ) {}

  async ingestDocument(
    documentId: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<number> {
    this.assertNotTimedOut(signal);
    const texts = await splitContent(content);

    this.assertNotTimedOut(signal);
    const embeddings = await embedTexts(texts, signal);

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
      throw new IngestTimeoutError(config.ingestTimeoutMs);
    }
  }
}

import {
  GatewayTimeoutException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import type { DocumentDto } from '@kh/shared';
import { DEFAULT_INGEST_TIMEOUT_MS } from '@kh/shared';
import { randomUUID } from 'node:crypto';
import type { Model } from 'mongoose';
import type { Repository } from 'typeorm';
import { CURRENT_USER_ID, cfgInt } from '../config';
import { DocumentEntity } from './entities/document.entity';
import { DocumentContent } from './schemas/document-content.schema';
import type { DocumentContentDoc } from './schemas/document-content.schema';

class IngestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`摄取超时（${timeoutMs}ms），文档已标记为 failed`);
    this.name = 'IngestTimeoutError';
  }
}

// 上传校验、摄取与删除编排集中在此。
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly ingestTimeoutMs: number;

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    @InjectModel(DocumentContent.name)
    private readonly contents: Model<DocumentContentDoc>,
    cfg: ConfigService,
  ) {
    this.ingestTimeoutMs = cfgInt(
      cfg,
      'INGEST_TIMEOUT_MS',
      DEFAULT_INGEST_TIMEOUT_MS,
    );
  }

  // 同步摄取：响应即最终结果。
  async ingestUpload(file: Express.Multer.File): Promise<DocumentDto> {
    const title = titleFromFilename(file.originalname);
    const content = file.buffer.toString('utf8').replace(/^\uFEFF/, '');

    // 第一步即建行且初始 status='failed'，成功收尾才改 'ready'；
    // 中途崩溃自然留 failed，可删后重传。
    const document = await this.documentsRepo.save({
      id: randomUUID(),
      title,
      status: 'failed',
      userId: CURRENT_USER_ID,
    });

    // 全流程包 INGEST_TIMEOUT_MS 超时（Promise.race）；
    // abort 同时被管线内各步检查，超时后不再继续写入。
    const abort = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeoutGate = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new IngestTimeoutError(this.ingestTimeoutMs));
      }, this.ingestTimeoutMs);
    });

    try {
      const pipeline = this.runPipeline(document.id, content, abort.signal);
      // race 输掉的分支不得成为 unhandled rejection。
      pipeline.catch(() => undefined);
      await Promise.race([pipeline, timeoutGate]);
      this.logger.log(`摄取成功 doc=${document.id} title="${title}"`);
      return {
        id: document.id,
        title,
        status: 'ready',
        created_at: document.createdAt.toISOString(),
      };
    } catch (err) {
      await this.cleanupFailed(document.id, err);
      throw this.toHttpException(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // 写入顺序固定 PG（documents 行已在调用前插入）→ Mongo 正文。
  private async runPipeline(
    documentId: string,
    content: string,
    signal: AbortSignal,
  ): Promise<void> {
    await this.contents.create({ document_id: documentId, content });
    if (signal.aborted) throw new IngestTimeoutError(this.ingestTimeoutMs);
    await this.documentsRepo.update(documentId, { status: 'ready' });
  }

  // 不暴露 user_id（契约仅 id/title/status/created_at）。
  async list(): Promise<DocumentDto[]> {
    const rows = await this.documentsRepo.find({
      select: { id: true, title: true, status: true, createdAt: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      created_at: row.createdAt.toISOString(),
    }));
  }

  // 双库清理集中在此：删 PG 行 + 删 Mongo 正文。
  // 两步均无条件执行 → 目标不存在时幂等；任一侧残留时重试 DELETE 会补齐。
  async remove(id: string): Promise<void> {
    await this.documentsRepo.delete(id);
    await this.contents.deleteOne({ document_id: id });
    this.logger.log(`删除文档 doc=${id}`);
  }

  // 失败/超时：documents 行保持 failed；尽力清理 Mongo 正文。
  private async cleanupFailed(
    documentId: string,
    cause: unknown,
  ): Promise<void> {
    const reason = cause instanceof Error ? cause.message : String(cause);
    this.logger.error(`摄取失败 doc=${documentId}: ${reason}`);
    // 行创建即 failed（见 ingestUpload），无需回写状态。
    try {
      await this.contents.deleteOne({ document_id: documentId });
    } catch (e) {
      this.logger.error(`清理 Mongo 正文失败 doc=${documentId}: ${String(e)}`);
    }
  }

  private toHttpException(err: unknown): HttpException {
    if (err instanceof IngestTimeoutError) {
      return new GatewayTimeoutException(err.message);
    }
    const message = err instanceof Error ? err.message : String(err);
    return new InternalServerErrorException(`摄取失败：${message}`);
  }
}

function titleFromFilename(originalname: string): string {
  const base = originalname.split(/[\\/]/).pop() ?? originalname;
  const title = base.replace(/\.(md|txt)$/i, '');
  return title || base;
}

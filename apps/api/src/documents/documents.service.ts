import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DocumentDto } from '@kh/shared';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import { DocumentEntity } from './entities/document.entity';
import { IngestionService } from './ingestion.service';

// 摄取编排（ADR 0001）：POST /documents 只做受理——校验、落 processing 行、
// 把解析交给执行器，随即返回 202。md/txt 由本地执行器在请求内完成收敛，
// PDF 交给 MinerU 轮询器（issue #4 起接入）。
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    private readonly ingestion: IngestionService,
  ) {}

  // 受理即 202 + processing；md/txt 本地提取在返回前完成（首次轮询即 ready）。
  async acceptUpload(file: Express.Multer.File): Promise<DocumentDto> {
    const title = titleFromFilename(file.originalname);
    const content = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const id = randomUUID();
    const row = await this.documentsRepo.save({
      id,
      title,
      content: '',
      status: 'processing',
      failureReason: null,
      mineruTaskId: null,
    });
    await this.ingestion.completeLocal(id, content);
    this.logger.log(`摄取成功 doc=${id} title="${title}"`);
    return {
      id,
      title,
      status: 'processing',
      created_at: row.createdAt.toISOString(),
      failure_reason: null,
    };
  }

  // 不暴露 content（契约仅 id/title/status/created_at/failure_reason）。
  async list(): Promise<DocumentDto[]> {
    const rows = await this.documentsRepo.find({
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        failureReason: true,
      },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      created_at: row.createdAt.toISOString(),
      failure_reason: row.failureReason,
    }));
  }

  // 软删除：softDelete 写 deleted_at，find() 默认排除已删除行。
  // processing 行同样可删（撤销误传），后台轮询器据 liveness 检查跳过（issue #6）。
  // 回收站/恢复为后续工单；v1 误删靠 SQL 手工恢复。
  async remove(id: string): Promise<void> {
    await this.documentsRepo.softDelete(id);
    this.logger.log(`删除文档（软删除）doc=${id}`);
  }
}

function titleFromFilename(originalname: string): string {
  const base = originalname.split(/[\\/]/).pop() ?? originalname;
  const title = base.replace(/\.(md|txt)$/i, '');
  return title || base;
}

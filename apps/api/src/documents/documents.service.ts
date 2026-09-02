import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DocumentDto } from '@kh/shared';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import { DocumentEntity } from './entities/document.entity';

// 上传校验与摄取编排集中在此。单库写入：一次 INSERT 即完成摄取，
// 无中间态，崩溃即无行，无需 failed 残留清理。
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
  ) {}

  // 同步摄取：响应即最终结果。
  async ingestUpload(file: Express.Multer.File): Promise<DocumentDto> {
    const title = titleFromFilename(file.originalname);
    const content = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const document = await this.documentsRepo.save({
      id: randomUUID(),
      title,
      content,
      status: 'ready',
    });
    this.logger.log(`摄取成功 doc=${document.id} title="${title}"`);
    return {
      id: document.id,
      title,
      status: 'ready',
      created_at: document.createdAt.toISOString(),
    };
  }

  // 不暴露 content（契约仅 id/title/status/created_at）。
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

  async remove(id: string): Promise<void> {
    await this.documentsRepo.delete(id);
    this.logger.log(`删除文档 doc=${id}`);
  }
}

function titleFromFilename(originalname: string): string {
  const base = originalname.split(/[\\/]/).pop() ?? originalname;
  const title = base.replace(/\.(md|txt)$/i, '');
  return title || base;
}

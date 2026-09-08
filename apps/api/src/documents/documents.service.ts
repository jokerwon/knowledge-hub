import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { type DocumentDto } from '@kh/shared';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { Repository } from 'typeorm';
import type { AppConfig } from '../config';
import { DocumentEntity } from './entities/document.entity';
import { IngestionService } from './ingestion.service';

// 摄取编排（ADR 0001）：POST /documents 只做受理——校验、落 processing 行、
// 把解析交给执行器，随即返回 202。md/txt 由本地执行器在请求内完成收敛；
// PDF 入后台队列走 MinerU（并发上限 3，超出排队）。

const PDF_MAGIC = Buffer.from('%PDF-');

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly textMaxBytes: number;

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    private readonly ingestion: IngestionService,
    config: ConfigService<AppConfig>,
  ) {
    this.textMaxBytes = config.getOrThrow('upload', {
      infer: true,
    }).textMaxBytes;
  }

  // 受理即 202 + processing；同步可判定的违规（魔数/大小/UTF-8）在落库前 400。
  // md/txt 本地提取在返回前完成（首次轮询即 ready）。
  async acceptUpload(file: Express.Multer.File): Promise<DocumentDto> {
    const title = titleFromFilename(file.originalname);
    const pdf = isPdfName(file.originalname);
    if (pdf) {
      // PDF：魔数嗅探（决策 8）——multer 扩展名白名单外的第二道类型校验
      assertPdfMagic(file);
    } else {
      // md/txt：服务层判大小上限（multer 上限按 PDF 档设置）+ UTF-8 可解码
      assertTextUpload(file, this.textMaxBytes);
    }

    const id = randomUUID();
    const row = await this.documentsRepo.save({
      id,
      title,
      content: '',
      status: 'processing',
      failureReason: null,
      mineruTaskId: null,
    });

    if (pdf) {
      this.ingestion.enqueuePdf({
        docId: id,
        submit: { fileName: file.originalname, bytes: file.buffer },
      });
      this.logger.log(`PDF 已受理进入解析队列 doc=${id} title="${title}"`);
    } else {
      const content = decodeTextContent(file.buffer);
      await this.ingestion.completeLocal(id, content);
      this.logger.log(`摄取成功 doc=${id} title="${title}"`);
    }

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

function isPdfName(originalname: string): boolean {
  return path.extname(originalname).toLowerCase() === '.pdf';
}

// PDF 魔数嗅探（决策 8）：拦截改后缀伪装的非 PDF（如 .pdf 之名行的文本文件）。
function assertPdfMagic(file: Express.Multer.File): void {
  if (!file.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new BadRequestException(
      `文件内容不是有效的 PDF（缺少 %PDF- 文件头）：请确认 ${file.originalname} 未损坏或未改名伪装`,
    );
  }
}

// md/txt：大小超限（multer 上限按 PDF 档设置，此处按文本档精确判定）与
// UTF-8 可解码（魔数嗅探的文本档等价物）双校验。
function assertTextUpload(file: Express.Multer.File, maxBytes: number): void {
  if (file.buffer.length > maxBytes) {
    throw new BadRequestException(
      `.md / .txt 文件大小超过上限（≤ ${maxBytes} 字节），PDF 请使用 .pdf 扩展名`,
    );
  }
  try {
    decodeTextContent(file.buffer);
  } catch {
    throw new BadRequestException(
      `文件内容不是有效的 UTF-8 文本：请确认 ${file.originalname} 未损坏或未改名伪装`,
    );
  }
}

// fatal 解码：非法字节序列直接抛错；解码器默认剥离 BOM，与改造前的
// toString + replace(/^\uFEFF/) 语义一致（见 e2e 回归用例）。
function decodeTextContent(buffer: Buffer): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}

function titleFromFilename(originalname: string): string {
  const base = originalname.split(/[\\/]/).pop() ?? originalname;
  const title = base.replace(/\.(md|txt|pdf)$/i, '');
  return title || base;
}

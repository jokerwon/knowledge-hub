import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DocumentEntity } from './entities/document.entity';

// 摄取执行器与状态机推进（ADR 0001）：所有终态写入都必须经 transition——
// 只允许 processing → ready/failed 且行未被软删除，保证「删除后不复活」
// （issue #6）与用例间数据隔离天然成立。
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
  ) {}

  // 本地执行器：md/txt 的文本提取在调用方（请求内）完成，这里只做收敛写入。
  async completeLocal(docId: string, content: string): Promise<void> {
    if (await this.transition(docId, { status: 'ready', content })) {
      return;
    }
    // 影响行数为 0：行已被删除或已离开 processing，静默放弃即可。
    this.logger.warn(`本地摄取收敛被跳过 doc=${docId}（行已删除或状态已变）`);
  }

  // 终态/推进写入的唯一通道：带 status 与软删除守卫的条件更新。
  // 返回是否真的推进了（false = 行不存在 / 已删除 / 已不是 processing）。
  protected async transition(
    docId: string,
    patch: Partial<
      Pick<
        DocumentEntity,
        'status' | 'content' | 'failureReason' | 'mineruTaskId'
      >
    >,
  ): Promise<boolean> {
    const result = await this.documentsRepo
      .createQueryBuilder()
      .update(DocumentEntity)
      .set(patch)
      .where('id = :id AND status = :status AND deleted_at IS NULL', {
        id: docId,
        status: 'processing',
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}

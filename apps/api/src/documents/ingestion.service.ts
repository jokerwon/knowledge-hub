import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DEFAULT_PDF_MAX_PAGES } from '@kh/shared';
import { cfgInt } from '../config';
import type { MineruSnapshot } from '../mineru/mineru.client';
import { MineruClient } from '../mineru/mineru.client';
import type { Repository } from 'typeorm';
import { INGESTION_CLOCK, type IngestionClock } from './clock';
import { DocumentEntity } from './entities/document.entity';

// 在飞 MinerU 任务并发上限（ADR 0001 后果一节：单实例 3 个在飞，超出排队）。
const MAX_IN_FLIGHT_PDF_JOBS = 3;
// 15 分钟总超时，自提交 MinerU 起；超时置 failed，不自动重试（决策 6）。
const MINERU_TIMEOUT_MS = 15 * 60 * 1000;
// 轮询间隔：默认 5s；e2e 经 MINERU_POLL_INTERVAL_MS 调小。
const DEFAULT_POLL_INTERVAL_MS = 5_000;
// 轮询连续失败容忍：瞬时抖动不致命，持续故障尽快置失败（而非拖满 15 分钟）。
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

interface PdfJob {
  docId: string;
  // 新受理：待提交 MinerU
  submit?: { fileName: string; bytes: Buffer };
  // 启动恢复：崩溃前已提交，凭 batchId 续轮询，deadline 沿用原提交时刻
  resume?: { batchId: string; deadlineAt: number };
}

@Injectable()
export class IngestionService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(IngestionService.name);
  private readonly pollIntervalMs = cfgInt(
    'MINERU_POLL_INTERVAL_MS',
    DEFAULT_POLL_INTERVAL_MS,
  );
  private readonly pdfMaxPages = cfgInt('PDF_MAX_PAGES', DEFAULT_PDF_MAX_PAGES);
  private readonly queue: PdfJob[] = [];
  private running = 0;
  private stopped = false;

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    private readonly mineru: MineruClient,
    @Inject(INGESTION_CLOCK) private readonly clock: IngestionClock,
  ) {}

  // 应用关闭时停止派发与轮询循环；在途行保持 processing，下次启动由恢复逻辑接手。
  onApplicationShutdown(): void {
    this.stopped = true;
  }

  // 启动恢复（ADR 0001 决策 5）：扫描 processing 行——
  // 有 mineru_task_id 的（崩溃前已提交）入队续轮询；
  // 无任务号的（受理后、提交前崩溃的 PDF，或请求内收敛被打断的 md/txt）
  // 文件字节已不可得，无法重放，置 failed 提示重传。
  async onModuleInit(): Promise<void> {
    const rows = await this.documentsRepo.find({
      where: { status: 'processing' },
    });
    if (rows.length === 0) return;
    let resumed = 0;
    let interrupted = 0;
    for (const row of rows) {
      if (row.mineruTaskId) {
        // 表结构无提交时刻列（migration 只加 failure_reason/mineru_task_id）：
        // 以 created_at 近似提交时刻。偏差 = 受理到提交的排队时长，方向保守
        // （崩溃间隙也计入超时窗口），符合「15 分钟总超时」语义。
        this.enqueuePdf({
          docId: row.id,
          resume: {
            batchId: row.mineruTaskId,
            deadlineAt: row.createdAt.getTime() + MINERU_TIMEOUT_MS,
          },
        });
        resumed++;
      } else if (
        await this.transition(row.id, {
          status: 'failed',
          failureReason: '服务重启导致摄取中断：请重新上传',
        })
      ) {
        interrupted++;
      }
    }
    this.logger.log(
      `启动恢复：processing=${rows.length} 续轮询=${resumed} 中断置失败=${interrupted}`,
    );
  }
  // 本地执行器：md/txt 的文本提取在调用方（请求内）完成，这里只做收敛写入。
  async completeLocal(docId: string, content: string): Promise<void> {
    if (await this.transition(docId, { status: 'ready', content })) {
      return;
    }
    // 影响行数为 0：行已被删除或已离开 processing，静默放弃即可。
    this.logger.warn(`本地摄取收敛被跳过 doc=${docId}（行已删除或状态已变）`);
  }

  // PDF 入队：受理请求立即返回，解析在后台推进（并发上限内派发，超出排队）。
  enqueuePdf(job: PdfJob): void {
    this.queue.push(job);
    this.dispatch();
  }

  private dispatch(): void {
    while (
      !this.stopped &&
      this.running < MAX_IN_FLIGHT_PDF_JOBS &&
      this.queue.length > 0
    ) {
      const job = this.queue.shift()!;
      this.running++;
      void this.runPdfJob(job)
        .catch((err) => {
          // runPdfJob 自身已兜底；这里防的是兜底写入（DB 已关等）再抛错
          this.logger.error(
            `PDF 摄取任务异常退出 doc=${job.docId}`,
            err instanceof Error ? err.stack : String(err),
          );
        })
        .finally(() => {
          this.running--;
          this.dispatch();
        });
    }
  }

  private async runPdfJob(job: PdfJob): Promise<void> {
    try {
      if (job.resume) {
        // 恢复路径：任务已在 MinerU 侧存在，直接续轮询
        await this.awaitTerminalState(
          job.docId,
          job.resume.batchId,
          job.resume.deadlineAt,
        );
        return;
      }
      // 排队期间行可能已被删除/截断：提交前先验活，不白扔 MinerU 配额
      if (!(await this.isAlive(job.docId))) return;
      const batchId = await this.mineru.submitFile(
        job.submit!.fileName,
        job.submit!.bytes,
        job.docId,
      );
      if (!(await this.transition(job.docId, { mineruTaskId: batchId }))) {
        return; // 受理后、任务号落库前被删除
      }
      const deadlineAt = this.clock.now().getTime() + MINERU_TIMEOUT_MS;
      await this.awaitTerminalState(job.docId, batchId, deadlineAt);
    } catch (err) {
      // 提交/下载失败与超时外的意外错误：MinerU 服务故障类
      await this.fail(job.docId, `MinerU 服务故障：${messageOf(err)}`);
    }
  }

  // 轮询循环：每次迭代先验活（删除/截断后跳过，不再推进），再取批次快照，
  // 终态写入带守卫；deadline 到点置 failed（解析超时）。
  private async awaitTerminalState(
    docId: string,
    batchId: string,
    deadlineAt: number,
  ): Promise<void> {
    let consecutiveErrors = 0;
    for (;;) {
      if (this.stopped) return;
      if (!(await this.isAlive(docId))) return;
      let snapshot: MineruSnapshot | null = null;
      try {
        snapshot = await this.mineru.getBatchResult(batchId);
        consecutiveErrors = 0;
      } catch (err) {
        if (++consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          await this.fail(
            docId,
            `MinerU 服务故障：轮询连续失败（${messageOf(err)}）`,
          );
          return;
        }
      }
      if (snapshot) {
        if (snapshot.state === 'done' && snapshot.fullZipUrl) {
          const markdown = await this.mineru.fetchMarkdown(snapshot.fullZipUrl);
          if (
            await this.transition(docId, { status: 'ready', content: markdown })
          ) {
            this.logger.log(`PDF 解析完成 doc=${docId}`);
          }
          return;
        }
        if (snapshot.state === 'failed') {
          await this.fail(
            docId,
            classifyMineruFailure(snapshot.errMsg, this.pdfMaxPages),
          );
          return;
        }
        if (
          snapshot.totalPages !== null &&
          snapshot.totalPages > this.pdfMaxPages
        ) {
          await this.fail(
            docId,
            `页数超过上限：PDF 最多 ${this.pdfMaxPages} 页（实际 ${snapshot.totalPages} 页），请拆分后重新上传`,
          );
          return;
        }
      }

      if (this.clock.now().getTime() >= deadlineAt) {
        await this.fail(docId, '解析超时：超过 15 分钟未完成，请重新上传');
        return;
      }
      await this.clock.sleep(this.pollIntervalMs);
    }
  }

  private async fail(docId: string, reason: string): Promise<void> {
    if (
      await this.transition(docId, { status: 'failed', failureReason: reason })
    ) {
      this.logger.warn(`摄取失败 doc=${docId} reason="${reason}"`);
    }
  }

  // 终态/推进写入的唯一通道：带 status 与软删除守卫的条件更新。
  // 返回是否真的推进了（false = 行不存在 / 已删除 / 已不是 processing）。
  private async transition(
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

  private async isAlive(docId: string): Promise<boolean> {
    const row = await this.documentsRepo.findOne({
      where: { id: docId, status: 'processing' },
      select: { id: true },
    });
    return row !== null;
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// MinerU state=failed 的原因归类（issue #5）：err_msg 是外部输入，按关键词
// 尽力分类，无法识别时保留原文归入「解析失败」。
function classifyMineruFailure(errMsg: string, maxPages: number): string {
  if (/encrypt|password|加密|密码/i.test(errMsg)) {
    return '文件已加密：暂不支持加密 PDF，请解密后重新上传';
  }
  if (
    /page|页/i.test(errMsg) &&
    /exceed|limit|超过|上限|too many/i.test(errMsg)
  ) {
    return `页数超过上限：PDF 最多 ${maxPages} 页，请拆分后重新上传`;
  }
  return `解析失败：${errMsg || 'MinerU 未返回原因'}`;
}

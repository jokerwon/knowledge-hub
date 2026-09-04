// PDF 摄取链路（issue #4）：MinerU 在其 HTTP 网络边界 fake（进程内 server 拦截
// 任务创建/轮询/结果下载），被测系统对它一无所知。钉住：上传受理 202 → 后台
// 提交（批次申请 + 原始字节上传）→ 轮询收敛 ready、content 为结果包 full.md、
// mineru_task_id 落库；同步可判定违规（魔数/超限/MIME）直接 400。
import type { Server } from 'node:http';
import request from 'supertest';
import type { DocumentDto } from '@kh/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  PDF_MAX_BYTES,
  UUID_RE,
  errorMessage,
  upload,
  waitFor,
} from './fixtures';
import {
  startFakeMineru,
  type FakeMineru,
  type FakeMineruTask,
} from './fake-mineru';
import {
  documentRow,
  getAccessToken,
  resetData,
  startApp,
  stopApp,
} from './harness';

// 最小合法 PDF 头：%PDF- 魔数 + 版本行（MinerU 侧解析由 fake 承担）。
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n',
);

describe('PDF 摄取（fake MinerU）', () => {
  let server: Server;
  let token: string;
  let mineru: FakeMineru;

  beforeAll(async () => {
    // 先清库再起应用：避免上一 spec 残留的 processing 行在启动期产生后台噪声
    await resetData();
    mineru = await startFakeMineru();
    // 必须先于 startApp：MinerUClient 在实例化期读取 API base
    process.env.MINERU_API_BASE = mineru.url;
    server = await startApp();
    token = await getAccessToken();
  });
  afterAll(async () => {
    await stopApp();
    await mineru.close();
  });
  beforeEach(async () => {
    await resetData();
    token = await getAccessToken();
    // fake 任务表跨用例累积：清空保证 latestTask 取到本用例的任务
    mineru.tasks.clear();
  });

  async function listDocs(): Promise<DocumentDto[]> {
    const res = await request(server)
      .get('/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body as DocumentDto[];
  }

  // 取 fake 里最新创建的任务（每用例只上传一个 PDF）
  async function latestTask(): Promise<FakeMineruTask> {
    await waitFor(() => mineru.tasks.size > 0);
    const task = [...mineru.tasks.values()].at(-1);
    if (!task) throw new Error('fake mineru 无任务');
    return task;
  }

  describe('happy path：受理 → 提交 → 轮询 → 收敛 ready', () => {
    it('上传 PDF → 202 + processing，解析完成后 ready 且 content 为 markdown', async () => {
      const res = await upload(server, token, {
        name: '论文.pdf',
        content: MINIMAL_PDF,
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(202);
      const doc = res.body as DocumentDto;
      expect(doc.id).toMatch(UUID_RE);
      expect(doc.title).toBe('论文'); // 标题剥离 .pdf，不读 PDF 元数据
      expect(doc.status).toBe('processing');
      expect(doc.failure_reason).toBeNull();

      // 提交完整性：fake 收到原始字节，data_id 即文档 id（结果侧对账凭据）
      const task = await latestTask();
      expect(task.fileName).toBe('论文.pdf');
      expect(task.dataId).toBe(doc.id);
      expect(task.uploadedBytes?.equals(MINIMAL_PDF)).toBe(true);

      // 驱动 fake 到终态：done + 结果包内 full.md
      task.markdown = '# 解析结果\n\nMinerU 输出的 markdown 正文';
      task.state = 'done';

      await waitFor(async () => {
        const docs = await listDocs();
        return docs.some((d) => d.id === doc.id && d.status === 'ready');
      });

      const row = await documentRow(doc.id);
      expect(row?.status).toBe('ready');
      expect(row?.content).toBe('# 解析结果\n\nMinerU 输出的 markdown 正文');
      expect(row?.mineru_task_id).toBe(task.batchId);
      expect(row?.failure_reason).toBeNull();
    });

    it('结果包为 stored（method 0）条目时同样解出 full.md', async () => {
      const res = await upload(server, token, {
        name: 'stored.pdf',
        content: MINIMAL_PDF,
        contentType: 'application/pdf',
      });
      const doc = res.body as DocumentDto;
      const task = await latestTask();
      // fake 按 zipDeflated 开关生成两种物理布局，覆盖读取端 stored/deflate 两条路径
      task.zipDeflated = false;
      task.markdown = 'stored 布局的正文';
      task.state = 'done';

      await waitFor(async () => {
        const docs = await listDocs();
        return docs.some((d) => d.id === doc.id && d.status === 'ready');
      });
      const row = await documentRow(doc.id);
      expect(row?.content).toBe('stored 布局的正文');
    });
  });

  describe('上传校验：同步可判定违规一律 400', () => {
    it('伪装 PDF（.pdf 扩展名 + 文本内容）→ 400 且文案点明 %PDF- 文件头', async () => {
      const res = await upload(server, token, {
        name: '伪装.pdf',
        content: Buffer.from('这不是 PDF，只是改了扩展名的文本'),
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('%PDF-');
    });

    it('恰好 20 MiB（到达 multer 上限）→ 400', async () => {
      const padding = Buffer.alloc(PDF_MAX_BYTES - MINIMAL_PDF.length, 0x25);
      const res = await upload(server, token, {
        name: 'cap.pdf',
        content: Buffer.concat([MINIMAL_PDF, padding]),
        contentType: 'application/pdf',
      });

      // busboy 到达即拒的 off-by-one 语义在 PDF 档保留（文案含两档上限）
      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('文件大小超过上限');
    });

    it('20 MiB 减 1 字节 → 202（当前实际接受的上限）', async () => {
      const padding = Buffer.alloc(
        PDF_MAX_BYTES - 1 - MINIMAL_PDF.length,
        0x25,
      );
      const res = await upload(server, token, {
        name: 'max.pdf',
        content: Buffer.concat([MINIMAL_PDF, padding]),
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(202);
    });

    it('.pdf 扩展名但 MIME 为 text/plain → 400（MIME 冲突）', async () => {
      const res = await upload(server, token, {
        name: 'mismatch.pdf',
        content: MINIMAL_PDF,
        contentType: 'text/plain',
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('仅支持 .md / .txt / .pdf');
    });
  });

  describe('失败语义：终态 failed 且 failure_reason 分类明确', () => {
    // 通用收敛助手：上传后（可选）驱动 fake 任务剧本，等待该文档收敛到 failed。
    // drive 省略用于不依赖 fake 任务的剧本（如提交阶段服务故障）。
    async function convergeToFailed(
      drive?: (task: FakeMineruTask) => void,
    ): Promise<DocumentDto> {
      const res = await upload(server, token, {
        name: '被测.pdf',
        content: MINIMAL_PDF,
        contentType: 'application/pdf',
      });
      expect(res.status).toBe(202);
      const doc = res.body as DocumentDto;
      if (drive) {
        const task = await latestTask();
        await waitFor(() => task.uploadedBytes !== null);
        drive(task);
      }
      let failed: DocumentDto | undefined;
      await waitFor(async () => {
        const docs = await listDocs();
        failed = docs.find((d) => d.id === doc.id && d.status === 'failed');
        return failed !== undefined;
      });
      return failed!;
    }

    it('MinerU state=failed + 加密类 err_msg → 文件已加密', async () => {
      const failed = await convergeToFailed((task) => {
        task.state = 'failed';
        task.errMsg = 'The file is encrypted and requires a password';
      });
      expect(failed.failure_reason).toContain('文件已加密');
      expect(failed.failure_reason).toContain('解密');
    });

    it('MinerU state=failed + 页数超限类 err_msg → 页数超过上限', async () => {
      const failed = await convergeToFailed((task) => {
        task.state = 'failed';
        task.errMsg = 'Page count exceeds the maximum limit of 200 pages';
      });
      expect(failed.failure_reason).toContain('页数超过上限');
      expect(failed.failure_reason).toContain('100 页');
    });

    it('running 期上报 total_pages 超过 PDF_MAX_PAGES → 页数超过上限（含实际页数）', async () => {
      const failed = await convergeToFailed((task) => {
        task.state = 'running';
        task.totalPages = 150;
      });
      expect(failed.failure_reason).toContain('页数超过上限');
      expect(failed.failure_reason).toContain('150');
    });

    it('MinerU state=failed + 一般 err_msg → 解析失败且保留原文', async () => {
      const failed = await convergeToFailed((task) => {
        task.state = 'failed';
        task.errMsg =
          'Unsupported file format, please upload a valid file type';
      });
      expect(failed.failure_reason).toContain('解析失败');
      expect(failed.failure_reason).toContain('Unsupported file format');
    });

    it('提交阶段服务故障（批次申请 500）→ MinerU 服务故障', async () => {
      mineru.failCreateStatus = 500;
      try {
        const failed = await convergeToFailed();
        expect(failed.failure_reason).toContain('MinerU 服务故障');
        expect(failed.failure_reason).toContain('/api/v4/file-urls/batch');
      } finally {
        mineru.failCreateStatus = null;
      }
    });

    it('轮询持续故障（连续 5 次 500）→ MinerU 服务故障（轮询连续失败）', async () => {
      mineru.failPollStatus = 503;
      try {
        const failed = await convergeToFailed();
        expect(failed.failure_reason).toContain('MinerU 服务故障');
        expect(failed.failure_reason).toContain('轮询连续失败');
      } finally {
        mineru.failPollStatus = null;
      }
    });
  });

  describe('韧性与并发（issue #6）', () => {
    it('在飞并发上限 3：第 4/5 个任务排队，前序完成后才提交', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await upload(server, token, {
          name: `批量-${i}.pdf`,
          content: MINIMAL_PDF,
          contentType: 'application/pdf',
        });
        expect(res.status).toBe(202);
        ids.push((res.body as DocumentDto).id);
      }

      // 确定性不变量：派发只在占位释放后发生，而释放只在任务终态后发生——
      // 无任务完成时 MinerU 侧见到的任务数封顶在 3
      await waitFor(() => mineru.tasks.size === 3);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mineru.tasks.size).toBe(3);

      // 完成前 3 个 → 后 2 个才被提交
      for (const task of [...mineru.tasks.values()]) {
        task.state = 'done';
        task.markdown = '# 批量完成';
      }
      await waitFor(() => mineru.tasks.size === 5);
      for (const task of [...mineru.tasks.values()].slice(3)) {
        task.state = 'done';
        task.markdown = '# 批量完成';
      }

      await waitFor(async () => {
        const docs = await listDocs();
        return (
          docs.filter((d) => ids.includes(d.id) && d.status === 'ready')
            .length === 5
        );
      });
    });

    it('删除 processing 文档 → 轮询器跳过该任务，状态不复活', async () => {
      const res = await upload(server, token, {
        name: '误传.pdf',
        content: MINIMAL_PDF,
        contentType: 'application/pdf',
      });
      const doc = res.body as DocumentDto;
      const task = await latestTask();
      await waitFor(() => task.uploadedBytes !== null);

      // 处理中删除（撤销误传）
      const del = await request(server)
        .delete(`/documents/${doc.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      // MinerU 侧照常完成：轮询循环验活失败应跳过，终态写入被守卫拦下
      task.state = 'done';
      task.markdown = '# 不应落地';
      await new Promise((resolve) => setTimeout(resolve, 500));

      const docs = await listDocs();
      expect(docs.find((d) => d.id === doc.id)).toBeUndefined();
      const row = await documentRow(doc.id);
      expect(row?.deleted_at).not.toBeNull();
      expect(row?.status).toBe('processing'); // 不复活
    });
  });
});

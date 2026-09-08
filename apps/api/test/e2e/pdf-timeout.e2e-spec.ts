// 解析超时语义（issue #5）：自提交 MinerU 起 15 分钟总超时置 failed，不自动
// 重试。时间行为经注入 FakeClock 驱动——不等真实 15 分钟。
import type { Server } from 'node:http';
import request from 'supertest';
import type { DocumentDto } from '@kh/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { upload, waitFor } from './fixtures';
import { FakeClock } from './fake-clock';
import { startFakeMineru, type FakeMineru } from './fake-mineru';
import { getAccessToken, resetData, startApp, stopApp } from './harness';

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n',
);

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

describe('PDF 解析超时（注入时钟）', () => {
  let server: Server;
  let token: string;
  let mineru: FakeMineru;
  let clock: FakeClock;

  beforeAll(async () => {
    await resetData();
    mineru = await startFakeMineru();
    // 必须先于 startApp：配置工厂在应用初始化期读取 API base
    process.env.MINERU_API_BASE = mineru.url;
    clock = new FakeClock();
    server = await startApp({ clock });
    token = await getAccessToken();
  });
  afterAll(async () => {
    await stopApp();
    await mineru.close();
  });
  beforeEach(async () => {
    await resetData();
    token = await getAccessToken();
    mineru.tasks.clear();
    // FakeClock 有意不重置：deadline 相对 clock.now() 计算，虚拟时间顺延
    // 只会让后续用例的窗口更宽，不影响断言。
  });
  it('任务 15 分钟未到终态 → failed 且原因为解析超时', async () => {
    const res = await upload(server, token, {
      name: '缓慢.pdf',
      content: MINIMAL_PDF,
      contentType: 'application/pdf',
    });
    expect(res.status).toBe(202);
    const doc = res.body as DocumentDto;

    // 等提交完成（字节已上传），把任务卡在 running
    await waitFor(() => {
      const task = [...mineru.tasks.values()].at(-1);
      return task?.uploadedBytes != null;
    });
    const task = [...mineru.tasks.values()].at(-1)!;
    task.state = 'running';
    // 等轮询循环挂起首个 sleep（deadline 已定格）再推进，避免抢跑
    await waitFor(() => clock.pendingSleeps > 0);

    // 虚拟推进 15 分钟：轮询循环醒来即越 deadline → failed（解析超时）
    await clock.advanceBy(FIFTEEN_MINUTES_MS);

    await waitFor(async () => {
      const list = await request(server)
        .get('/documents')
        .set('Authorization', `Bearer ${token}`);
      const docs = list.body as DocumentDto[];
      return docs.some((d) => d.id === doc.id && d.status === 'failed');
    });

    const list = await request(server)
      .get('/documents')
      .set('Authorization', `Bearer ${token}`);
    const failed = (list.body as DocumentDto[]).find((d) => d.id === doc.id);
    expect(failed?.failure_reason).toContain('解析超时');
    expect(failed?.failure_reason).toContain('15 分钟');
  });

  it('deadline 前完成 → 不触发超时（虚拟时间未越界的反例）', async () => {
    const res = await upload(server, token, {
      name: '及时.pdf',
      content: MINIMAL_PDF,
      contentType: 'application/pdf',
    });
    const doc = res.body as DocumentDto;
    // 等提交完成 + 轮询循环挂起（deadline 已定格）
    await waitFor(() => {
      const task = [...mineru.tasks.values()].at(-1);
      return task?.uploadedBytes != null;
    });
    const task = [...mineru.tasks.values()].at(-1)!;
    await waitFor(() => clock.pendingSleeps > 0);

    // 只推进 14 分钟 + 完成 → ready；超时路径不应误伤
    await clock.advanceBy(FIFTEEN_MINUTES_MS - 60_000);
    task.state = 'done';
    task.markdown = '# 及时完成';
    // 等循环重新挂起 sleep 再推进：否则第二次 advanceBy 可能赶在
    // 新 sleep 注册之前，无人可唤醒
    await waitFor(() => clock.pendingSleeps > 0);
    await clock.advanceBy(10_000);

    let converged: DocumentDto | undefined;
    await waitFor(async () => {
      const list = await request(server)
        .get('/documents')
        .set('Authorization', `Bearer ${token}`);
      converged = (list.body as DocumentDto[]).find((d) => d.id === doc.id);
      return converged?.status === 'ready';
    });
    // 明确断言未走超时路径（而非仅等到 ready）
    expect(converged?.failure_reason).toBeNull();
  });
});

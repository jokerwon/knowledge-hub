// 启动恢复（issue #6）：服务启动时扫描 processing 文档——有 mineru_task_id 的
// 凭批次号续轮询直至收敛（含崩溃间隙已在 MinerU 侧完成的场景）；无任务号的
// 无法重放，置 failed 提示重传。种子行必须在 startApp 前经夹具 SQL 就位，
// 恢复扫描在应用启动期（onModuleInit）执行。
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import type { DocumentDto } from '@kh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { waitFor } from './fixtures';
import { startFakeMineru, type FakeMineru } from './fake-mineru';
import {
  getAccessToken,
  resetData,
  seedProcessingDocument,
  startApp,
  stopApp,
} from './harness';

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

describe('启动恢复（进程崩溃不丢任务）', () => {
  let server: Server;
  let token: string;
  let mineru: FakeMineru;
  // 种子行 id：beforeAll 一次就位，三个用例各断言其一，之间不重置数据
  const resumeId = randomUUID();
  const overdueId = randomUUID();
  const interruptedId = randomUUID();

  beforeAll(async () => {
    // 清库并播种受测账号（resetData），再放种子行，最后才启动应用
    await resetData();
    mineru = await startFakeMineru();
    // 必须先于 startApp：配置工厂在应用初始化期读取 API base
    process.env.MINERU_API_BASE = mineru.url;

    // 剧本 1：崩溃前已提交、MinerU 侧已完成 → 恢复轮询一次即收敛 ready
    const doneTask = mineru.createTask({ batchId: randomUUID() });
    doneTask.state = 'done';
    doneTask.markdown = '# 崩溃间隙完成的解析';
    await seedProcessingDocument({
      id: resumeId,
      title: '恢复-已完成',
      mineruTaskId: doneTask.batchId,
      createdAt: minutesAgo(2),
    });

    // 剧本 2：崩溃前已提交、恢复时仍在解析、但 15 分钟总超时已过 → 解析超时。
    // 注意锚点耦合：恢复 deadline = created_at + 15min（onModuleInit 的近似），
    // 若未来改用提交时刻列，20 分钟的种子需同步调整。
    const runningTask = mineru.createTask({ batchId: randomUUID() });
    runningTask.state = 'running';
    await seedProcessingDocument({
      id: overdueId,
      title: '恢复-已超时',
      mineruTaskId: runningTask.batchId,
      createdAt: minutesAgo(20),
    });

    // 剧本 3：受理后、提交前崩溃（无任务号）→ 无法重放，置失败提示重传
    await seedProcessingDocument({
      id: interruptedId,
      title: '恢复-中断',
      createdAt: minutesAgo(1),
    });
    server = await startApp();
    token = await getAccessToken();
  });

  afterAll(async () => {
    await stopApp();
    await mineru.close();
  });

  async function docById(id: string): Promise<DocumentDto | undefined> {
    const res = await request(server)
      .get('/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return (res.body as DocumentDto[]).find((d) => d.id === id);
  }

  it('已提交且 MinerU 侧完成的 processing 行 → 恢复即收敛 ready', async () => {
    await waitFor(async () => (await docById(resumeId))?.status === 'ready');
    const doc = await docById(resumeId);
    expect(doc?.failure_reason).toBeNull();
  });

  it('恢复时仍在解析但总超时已过 → failed 且原因为解析超时', async () => {
    await waitFor(async () => (await docById(overdueId))?.status === 'failed');
    const doc = await docById(overdueId);
    expect(doc?.failure_reason).toContain('解析超时');
  });

  it('无任务号的 processing 行（提交前崩溃）→ failed 且提示重新上传', async () => {
    await waitFor(
      async () => (await docById(interruptedId))?.status === 'failed',
    );
    const doc = await docById(interruptedId);
    expect(doc?.failure_reason).toContain('服务重启导致摄取中断');
    expect(doc?.failure_reason).toContain('重新上传');
  });
});

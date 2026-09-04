// FakeClock：INGESTION_CLOCK 的测试实现（issue #5 时间接缝）。虚拟时间从真实
// 当前时刻起算——与 DB 行的 created_at（真实 timestamptz）在同一时间轴上，
// 恢复场景的 deadline 计算天然一致。advanceBy 推进虚拟时钟并唤醒到点的
// sleeper，随后让出一小段真实时间让轮询循环的 IO 跑完。
import type { IngestionClock } from '../../src/documents/clock';

export class FakeClock implements IngestionClock {
  private nowMs = Date.now();
  private readonly waiters: Array<{ dueAt: number; resolve: () => void }> = [];

  // 挂起中的 sleep 数：> 0 说明被测循环已进入等待且 deadline 已定格——
  // 测试据此确认推进时机，避免在 deadline 计算前抢先 advanceBy 把它推远。
  get pendingSleeps(): number {
    return this.waiters.length;
  }

  now(): Date {
    return new Date(this.nowMs);
  }

  sleep(ms: number): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.waiters.push({ dueAt: this.nowMs + ms, resolve });
    return promise;
  }

  async advanceBy(ms: number): Promise<void> {
    this.nowMs += ms;
    const due = this.waiters.filter((w) => w.dueAt <= this.nowMs);
    for (const waiter of due) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
    // 轮询循环在 sleep 醒来后还要走 DB/HTTP 若干步：给足一拍真实时间收敛
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 50);
    await promise;
  }
}

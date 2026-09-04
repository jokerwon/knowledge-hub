import { Injectable } from '@nestjs/common';

// 轮询器时钟接缝（issue #1 实现决策）：15 分钟总超时等时间相关行为经注入
// 时钟驱动测试，不等真实时间。SystemClock 是生产实现；e2e 覆盖
// timeout 场景时以 FakeClock 覆写本 token。
export interface IngestionClock {
  now(): Date;
  sleep(ms: number): Promise<void>;
}

export const INGESTION_CLOCK = Symbol('INGESTION_CLOCK');

@Injectable()
export class SystemClock implements IngestionClock {
  now(): Date {
    return new Date();
  }

  sleep(ms: number): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
  }
}

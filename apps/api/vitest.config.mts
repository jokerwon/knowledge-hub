import { defineConfig } from 'vitest/config';

// e2e 契约测试唯一入口（vitest + supertest，进程内 Nest 应用 + 真实 PG 测试库）。
// 环境变量（DATABASE_URL 顶替为测试库等）在 setupFiles 中完成，先于测试文件
// import AppModule，保证应用连接的是 TEST_DATABASE_URL 指向的测试库。
export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    // globalSetup：主进程执行一次——重建测试库（DROP/CREATE）并跑全部 migration。
    globalSetup: ['test/e2e/global-setup.ts'],
    // 每个测试文件 import 前执行：加载根 .env、把 DATABASE_URL 顶成测试库。
    setupFiles: ['test/e2e/setup-env.ts'],
    // 所有 spec 共享同一个测试库：串行执行文件，用例间 truncate 才不会互相踩。
    fileParallelism: false,
    // 测试库在远程，网络往返比本地慢，放宽超时。
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

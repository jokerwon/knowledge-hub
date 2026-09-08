// vitest setupFiles：每个测试文件 import 之前执行（先于 AppModule 装配——
// ConfigModule 的 load 工厂在 DI 期才读 env，且 loadEnvFile 不覆盖已存在的
// 变量，因此这里的赋值必然生效）。
import { loadRootEnv } from '../../src/config';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_PDF_MAX_UPLOAD_BYTES,
  DEFAULT_PDF_MAX_PAGES,
} from '@kh/shared';

// 与应用同一入口加载根 .env（pnpm 脚本 CWD 为 apps/api，见 src/config）。
loadRootEnv();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL 未配置：请在仓库根 .env 指向 e2e 测试库（库名以 _test 结尾）',
  );
}

// 关键一步：把测试库顶到 DATABASE_URL，AppModule 的 TypeORM 连接必然是测试库。
process.env.DATABASE_URL = testDatabaseUrl;

// 以下覆盖让测试不依赖部署者本地 .env 的具体取值，钉住默认契约：
// JWT 密钥测试自用自签（token 全部经登录端点获取，与生产密钥无关）；
// md/txt 上限钉 shared 默认值，边界用例随之确定。
process.env.JWT_SECRET = 'e2e-test-jwt-secret';
process.env.UPLOAD_MAX_BYTES = String(DEFAULT_MAX_UPLOAD_BYTES);

// MinerU 测试环境：token 钉死假值；API_BASE 默认指向拒达地址——任何意外
// 外呼立即失败，绝无打到真云的可能。pdf 相关 spec 在 startApp 前把 base
// 指到本地 fake server（进程内 node:http）。
process.env.MINERU_API_TOKEN = 'e2e-mineru-token';
process.env.MINERU_API_BASE = 'http://127.0.0.1:9';
process.env.UPLOAD_PDF_MAX_BYTES = String(DEFAULT_PDF_MAX_UPLOAD_BYTES);
process.env.PDF_MAX_PAGES = String(DEFAULT_PDF_MAX_PAGES);
// 轮询间隔调小：非注入时钟的用例（收敛/并发）用真实时间驱动但不等 5s 一拍。
process.env.MINERU_POLL_INTERVAL_MS = '10';

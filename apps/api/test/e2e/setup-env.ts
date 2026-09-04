// vitest setupFiles：每个测试文件 import 之前执行（先于 AppModule 及其 import 的
// src/config——config 的 loadEnvFile 不覆盖已存在的变量，因此这里的赋值必然生效）。
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_MAX_UPLOAD_BYTES } from '@kh/shared';

// 与 src/config.ts 相同的定位方式：pnpm 脚本 CWD 为 apps/api，上溯 2 级到仓库根。
const ROOT_ENV = path.resolve(process.cwd(), '..', '..', '.env');
if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);

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

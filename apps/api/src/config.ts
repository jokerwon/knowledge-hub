import { existsSync } from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_PDF_MAX_PAGES,
  DEFAULT_PDF_MAX_UPLOAD_BYTES,
} from '@kh/shared';

// —— .env 加载 ——

// 加载 monorepo 根的 .env（Node ≥22 原生 loadEnvFile；与 dotenv 一样不覆盖已有
// 环境变量，可安全重复调用）。pnpm 脚本 CWD 为 apps/api，上溯 2 级到仓库根；
// 部署环境无 .env 时跳过（env 由容器注入）。
export function loadRootEnv(): void {
  const rootEnv = path.resolve(process.cwd(), '..', '..', '.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
}

// —— 解析助手：env 字符串 → 类型化值 ——

// 正整数：缺失或非法时回落默认值。
const intEnv = (key: string, fallback: number): number => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// 布尔：仅 '1' / 'true'（大小写不敏感）为真，其余（含缺失）为假。
const boolEnv = (key: string): boolean => {
  const v = process.env[key];
  return v === '1' || v?.toLowerCase() === 'true';
};

// —— 配置工厂 ——

// MinerU 官方云 API 默认端点；轮询间隔默认 5s（e2e 经 MINERU_POLL_INTERVAL_MS 调小）。
const DEFAULT_MINERU_API_BASE = 'https://mineru.net';
const DEFAULT_MINERU_POLL_INTERVAL_MS = 5_000;

export interface AppConfig {
  port: number;
  // 必填项保持 string | undefined，由各消费方在初始化期 fail-fast（沿用原有报错
  // 文案）：不同上下文的必填集合不同（typeorm CLI 只需 DATABASE_URL，user-cli
  // 不需要 JWT），集中校验会误伤部分上下文。
  jwtSecret: string | undefined;
  database: {
    url: string | undefined;
    ssl: boolean;
    logging: boolean;
  };
  mineru: {
    apiToken: string | undefined;
    apiBase: string;
    pollIntervalMs: number;
    pdfMaxPages: number;
  };
  rustfs: {
    enabled: boolean;
    endpoint: string;
    publicUrl: string;
    accessKey: string | undefined;
    secretKey: string | undefined;
    bucket: string;
    region: string;
  };
  upload: {
    textMaxBytes: number;
    pdfMaxBytes: number;
  };
}

// 唯一的 env → 类型化配置映射：Nest 侧经 ConfigModule.forRoot({ load: [loadAppConfig] })
// 在 DI 容器实例化期执行（每次 AppModule 装配都重跑，读到的是当时的 env）；
// typeorm CLI、user-cli、vitest 等无 DI 上下文直接调用同一函数。
export function loadAppConfig(): AppConfig {
  loadRootEnv();
  return {
    port: intEnv('PORT', 8001),
    jwtSecret: process.env.JWT_SECRET,
    database: {
      url: process.env.DATABASE_URL,
      ssl: boolEnv('PG_SSL'),
      logging: boolEnv('PG_LOGGING'),
    },
    mineru: {
      apiToken: process.env.MINERU_API_TOKEN,
      // 去尾部斜杠：端点拼接（`/api/v4/...`）不出现双斜杠。
      apiBase: (process.env.MINERU_API_BASE ?? DEFAULT_MINERU_API_BASE).replace(
        /\/+$/,
        '',
      ),
      pollIntervalMs: intEnv(
        'MINERU_POLL_INTERVAL_MS',
        DEFAULT_MINERU_POLL_INTERVAL_MS,
      ),
      pdfMaxPages: intEnv('PDF_MAX_PAGES', DEFAULT_PDF_MAX_PAGES),
    },
    upload: {
      // md/txt 档；PDF 档（multer fileSize 按此设置）。
      textMaxBytes: intEnv('UPLOAD_MAX_BYTES', DEFAULT_MAX_UPLOAD_BYTES),
      pdfMaxBytes: intEnv('UPLOAD_PDF_MAX_BYTES', DEFAULT_PDF_MAX_UPLOAD_BYTES),
    },
    rustfs: {
      enabled: boolEnv('RUSTFS_ENABLED'),
      endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://127.0.0.1:9000',
      publicUrl: (
        process.env.RUSTFS_PUBLIC_URL ?? 'http://127.0.0.1:9000'
      ).replace(/\/+$/, ''),
      accessKey: process.env.RUSTFS_ACCESS_KEY,
      secretKey: process.env.RUSTFS_SECRET_KEY,
      bucket: process.env.RUSTFS_BUCKET ?? 'knowledge-hub',
      region: process.env.RUSTFS_REGION ?? 'us-east-1',
    },
  };
}

import * as path from 'node:path';
import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_INGEST_TIMEOUT_MS,
  DEFAULT_MAX_UPLOAD_BYTES,
} from '@kh/shared';

// 配置经 @nestjs/config 统一加载：envFilePath 指向 monorepo 根的 .env
// （与 database/data-source.ts 同一约定）；pnpm 脚本的 CWD 为 apps/api，
// 上溯 2 级到仓库根。cli（typeorm 迁移、冒烟脚本）不经过 Nest 容器，
// 仍由 data-source.ts / 各脚本自行 dotenv，不走本模块。
const rootEnv = path.resolve(process.cwd(), '..', '..', '.env');

export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: rootEnv,
});

// 应用配置的形状：调用侧只依赖此接口，不直接接触 ConfigService 泛型。
export interface AppConfig {
  uploadMaxBytes: number;
  chunkSize: number;
  chunkOverlap: number;
  ingestTimeoutMs: number;
  embeddingDim: number;
  embed: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export const appConfigProvider: Provider = {
  provide: APP_CONFIG,
  inject: [ConfigService],
  useFactory: (cfg: ConfigService): AppConfig => {
    const int = (key: string, fallback: number): number => {
      const n = Number(cfg.get<string>(key));
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    return {
      uploadMaxBytes: int('UPLOAD_MAX_BYTES', DEFAULT_MAX_UPLOAD_BYTES),
      chunkSize: int('CHUNK_SIZE', DEFAULT_CHUNK_SIZE),
      chunkOverlap: int('CHUNK_OVERLAP', DEFAULT_CHUNK_OVERLAP),
      ingestTimeoutMs: int('INGEST_TIMEOUT_MS', DEFAULT_INGEST_TIMEOUT_MS),
      embeddingDim: int('EMBEDDING_DIM', DEFAULT_EMBEDDING_DIM),
      embed: {
        baseUrl: cfg.get<string>('EMBED_BASE_URL') ?? '',
        apiKey: cfg.get<string>('EMBED_API_KEY') ?? '',
        model: cfg.get<string>('EMBED_MODEL') ?? '',
      },
    };
  },
};

// 单用户起步（ADR-0002）：user_id 的唯一来源，当前恒为 null，
// 未来补认证后只改这一处。业务代码禁止再出现其它 user 假设。
export const CURRENT_USER_ID: string | null = null;

// 集中注册 APP_CONFIG：业务模块统一 import 此模块，不再各自重复 provide。
// @Global：第三方模块（如 MulterModule.registerAsync 的工厂）在自己的注入器里
// 解析 inject: [APP_CONFIG]，无法导入本模块，必须全局可见。
@Global()
@Module({
  imports: [AppConfigModule],
  providers: [appConfigProvider],
  exports: [APP_CONFIG],
})
export class AppConfigProviderModule {}

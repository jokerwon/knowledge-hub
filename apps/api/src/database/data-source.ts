import * as path from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../config';
import { DocumentEntity } from '../documents/entities/document.entity';
import { UserEntity } from '../users/entities/user.entity';

// Nest 侧由 AppModule 的 forRootAsync 注入 ConfigService 后调用；typeorm CLI、
// user-cli、e2e 等无 DI 上下文直接传 loadAppConfig().database——env 解析统一在
// src/config.ts。
export function buildDataSourceOptions(
  database: AppConfig['database'],
): DataSourceOptions {
  if (!database.url) {
    throw new Error('DATABASE_URL 未配置，请检查 .env');
  }

  // 编译后本文件位于 dist/database/data-source.js；typeorm CLI（ts-node）则为 src 下 的 .ts。
  // 扩展名按当前文件实际情况取，不能用 NODE_ENV 判断——nest start --watch 也是跑编译后的 js，
  // 但 dev 环境 NODE_ENV 不是 production，曾导致 entities glob 匹配不到文件、实体未注册。
  const databaseDir = __dirname;
  const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

  return {
    type: 'postgres',
    url: database.url,
    // 实体归领域目录（documents/entities 等），显式注册；migrations 集中在本目录，仍按 glob 扫描。
    entities: [DocumentEntity, UserEntity],
    migrations: [path.join(databaseDir, 'migrations', `*.${ext}`)],
    synchronize: false,
    migrationsRun: false, // 不在启动时自动跑 migration；显式 pnpm migration:run。
    ssl: database.ssl,
    logging: database.logging,
  };
}

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { DocumentEntity } from '../documents/entities/document.entity';
import { ChunkEntity } from '../documents/entities/chunk.entity';

// 加载 monorepo 根的 .env；dotenv 默认不覆盖已存在的环境变量。
// process.cwd() 在 pnpm 脚本里指向 apps/api；上溯 2 级到仓库根。
const ROOT_ENV = path.resolve(process.cwd(), '..', '..', '.env');
dotenv.config({ path: ROOT_ENV });

const bool = (v: string | undefined, fallback: boolean): boolean => {
  if (!v) return fallback;
  return v === '1' || v.toLowerCase() === 'true';
};

export function buildDataSourceOptions(): DataSourceOptions {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置，请检查 .env');
  }

  // 编译后本文件位于 dist/database/data-source.js；typeorm CLI（ts-node）则为 src 下 的 .ts。
  // 扩展名按当前文件实际情况取，不能用 NODE_ENV 判断——nest start --watch 也是跑编译后的 js，
  // 但 dev 环境 NODE_ENV 不是 production，曾导致 entities glob 匹配不到文件、实体未注册。
  const databaseDir = __dirname;
  const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

  return {
    type: 'postgres',
    url: databaseUrl,
    // 实体归领域目录（documents/entities 等），显式注册；migrations 集中在本目录，仍按 glob 扫描。
    entities: [DocumentEntity, ChunkEntity],
    migrations: [path.join(databaseDir, 'migrations', `*.${ext}`)],
    synchronize: false,
    migrationsRun: false, // 不在启动时自动跑 migration；显式 pnpm migration:run。
    ssl: bool(process.env.PG_SSL, false),
    logging: bool(process.env.PG_LOGGING, false),
  };
}

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import type { DataSourceOptions } from 'typeorm';

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

  const isProd = process.env.NODE_ENV === 'production';
  // 编译后 data-source.ts 位于 dist/database/data-source.js；开发态 ts-node 也把它当此目录看待。
  // 因此 baseDir 始终指向编译后的 database/ 目录。
  const databaseDir = __dirname;
  const ext = isProd ? 'js' : 'ts';

  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [path.join(databaseDir, 'entities', `*.${ext}`)],
    migrations: [path.join(databaseDir, 'migrations', `*.${ext}`)],
    synchronize: false,
    migrationsRun: false, // 不在启动时自动跑 migration；显式 pnpm migration:run。
    ssl: bool(process.env.PG_SSL, false),
    logging: bool(process.env.PG_LOGGING, false),
    migrationsTableName: 'typeorm_migrations',
    metadataTableName: 'typeorm_metadata',
  };
}

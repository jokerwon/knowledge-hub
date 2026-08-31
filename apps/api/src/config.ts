import * as path from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';

// 配置经 @nestjs/config 统一加载（isGlobal，各处直接注入 ConfigService）：
// envFilePath 指向 monorepo 根的 .env（与 database/data-source.ts 同一约定）；
// pnpm 脚本的 CWD 为 apps/api，上溯 2 级到仓库根。
// cli（typeorm 迁移、冒烟脚本）不经过 Nest 容器，仍由 data-source.ts / 各脚本自行 dotenv。
export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: path.resolve(process.cwd(), '..', '..', '.env'),
});

// 正整数 env 读取：缺失或非法时回落默认值。
export function cfgInt(
  cfg: ConfigService,
  key: string,
  fallback: number,
): number {
  const n = Number(cfg.get<string>(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 单用户起步（ADR-0002）：user_id 的唯一来源，当前恒为 null，
// 未来补认证后只改这一处。业务代码禁止再出现其它 user 假设。
export const CURRENT_USER_ID: string | null = null;

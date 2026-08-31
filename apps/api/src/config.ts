import { existsSync } from 'node:fs';
import * as path from 'node:path';

// 加载 monorepo 根的 .env（Node ≥22 原生 loadEnvFile；与 dotenv 一样不覆盖已有环境变量）。
// pnpm 脚本 CWD 为 apps/api，上溯 2 级到仓库根；部署环境无 .env 时跳过（env 由容器注入）。
// 所有读 env 的模块都 import 本文件（cfgInt / CURRENT_USER_ID），import 副作用即完成加载。
const ROOT_ENV = path.resolve(process.cwd(), '..', '..', '.env');
if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);

// 正整数 env 读取：缺失或非法时回落默认值。
export function cfgInt(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 单用户起步：user_id 的唯一来源，当前恒为 null，
// 未来补认证后只改这一处。业务代码禁止再出现其它 user 假设。
export const CURRENT_USER_ID: string | null = null;

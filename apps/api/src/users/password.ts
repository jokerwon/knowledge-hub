import { compare, hash } from 'bcryptjs';

// 密码工具：service 与 CLI 共用，保证哈希与策略只有一份实现。
// bcryptjs（纯 JS）而非 bcrypt（原生编译）：内网小团队量级下性能足够，免去 node-gyp。

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(plain, passwordHash);
}

// 用户名策略：1-32 字符，字母数字与 _ -，不含空白。
// 返回错误信息或 null（合法）；调用方决定抛 HTTP 异常还是 CLI 报错。
export function validateUsername(value: string): string | null {
  if (typeof value !== 'string' || value.length === 0) return '用户名不能为空';
  if (value.length > 32) return '用户名不能超过 32 个字符';
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return '用户名只能包含字母、数字、下划线和连字符';
  }
  return null;
}

// 密码策略：8-72 字符（bcrypt 有效长度上限 72）。
export function validatePassword(value: string): string | null {
  if (typeof value !== 'string' || value.length === 0) return '密码不能为空';
  if (value.length < 8) return '密码至少 8 个字符';
  if (value.length > 72) return '密码不能超过 72 个字符';
  return null;
}

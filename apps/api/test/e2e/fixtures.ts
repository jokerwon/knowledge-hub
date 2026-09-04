// e2e 夹具常量与纯助手：不依赖应用生命周期，供 harness 与各 spec 共用。
import type { Server } from 'node:http';
import { DEFAULT_MAX_UPLOAD_BYTES } from '@kh/shared';
import request from 'supertest';

// 受测账号：resetData 每个用例重新播种，密码满足 8-72 字符策略。
export const TEST_USER = {
  username: 'e2e_tester',
  password: 'e2e-password-1',
};

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// md/txt 上限：直接引用 shared 默认值（setup-env 已把 env 钉在该默认值），
// 默认值变化时边界用例自动跟随，不与 shared 常量漂移。
export const UPLOAD_MAX_BYTES = DEFAULT_MAX_UPLOAD_BYTES;

// PG_SSL 解析与应用侧 buildDataSourceOptions 的 bool() 语义一致：
// 夹具/维护库的裸 pg Client 与应用连接在要求 SSL 的远程库上行为同步。
export function pgSsl(): boolean {
  const v = process.env.PG_SSL?.toLowerCase();
  return v === '1' || v === 'true';
}

export interface UploadFile {
  name: string;
  content: Buffer;
  contentType?: string;
}

// multipart 上传一个文件。MIME 显式给定，不依赖 superagent 按扩展名的推断。
export async function upload(
  server: Server,
  token: string,
  file: UploadFile,
): Promise<request.Response> {
  return request(server)
    .post('/documents')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', file.content, {
      filename: file.name,
      contentType: file.contentType ?? 'text/markdown',
    });
}

// Nest 异常响应体的 message 字段（UploadSizeFilter / BadRequest 均输出；
// 管道校验类错误为 string[]，两种都归一成可断言的字符串）。
// 响应体是外部输入：守卫式读取，不做内联断言形状。
export function errorMessage(res: request.Response): string {
  const body: unknown = res.body;
  if (body && typeof body === 'object' && 'message' in body) {
    const message: unknown = body.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
  }
  return '';
}

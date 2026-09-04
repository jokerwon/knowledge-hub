// documents 域契约钉住（issue #3 起）：ADR 0001 异步受理——POST /documents 返回
// 202 + processing；md/txt 由本地执行器在请求内完成收敛，首次列表轮询即 ready；
// 违规上传仍同步 400。契约从 issue #2 的「200 + ready 同步摄取」迁移到此形态，
// 是显式变更（响应码、status 语义、新增 failure_reason 字段）。
import type { Server } from 'node:http';
import request from 'supertest';
import type { DocumentDto } from '@kh/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UUID_RE, UPLOAD_MAX_BYTES, errorMessage, upload } from './fixtures';
import {
  documentRow,
  getAccessToken,
  resetData,
  startApp,
  stopApp,
} from './harness';

// 响应体 cast 说明：断言即校验——cast 到契约形状只为逐字段断言服务，
// 形状不符时下方断言立即失败，不存在静默读错。

const DOC_KEYS = ['created_at', 'failure_reason', 'id', 'status', 'title'];

async function listDocs(server: Server, token: string): Promise<DocumentDto[]> {
  const res = await request(server)
    .get('/documents')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body as DocumentDto[];
}

describe('documents 契约（异步受理）', () => {
  let server: Server;
  let token: string;

  beforeAll(async () => {
    server = await startApp();
  });
  afterAll(async () => {
    await stopApp();
  });
  beforeEach(async () => {
    await resetData();
    token = await getAccessToken();
  });

  describe('上传 md/txt：202 受理 + processing', () => {
    it('.md → 202 且 processing，响应形状恰为 id/title/status/created_at/failure_reason', async () => {
      const res = await upload(server, token, {
        name: '笔记.md',
        content: Buffer.from('# 标题\n\n正文'),
      });

      expect(res.status).toBe(202);
      const doc = res.body as DocumentDto;
      // 键集合严格钉住：content 等内部字段不得外泄
      expect(Object.keys(doc).sort()).toEqual(DOC_KEYS);
      expect(doc.id).toMatch(UUID_RE);
      expect(doc.title).toBe('笔记');
      expect(doc.status).toBe('processing');
      expect(doc.failure_reason).toBeNull();
      expect(Number.isNaN(Date.parse(doc.created_at))).toBe(false);
    });

    it('.md 受理后首次列表轮询即 ready（本地执行器在请求内收敛）', async () => {
      const res = await upload(server, token, {
        name: '笔记.md',
        content: Buffer.from('# 标题\n\n正文'),
      });
      const doc = res.body as DocumentDto;

      const docs = await listDocs(server, token);
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe(doc.id);
      expect(docs[0].status).toBe('ready');
      expect(docs[0].failure_reason).toBeNull();
    });

    it('.md 内容摄取回归：content 与上传字节一致（夹具 SQL 断言，content 不在 HTTP 契约内）', async () => {
      const content = '# 标题\n\n正文 \uFEFF带 BOM 的旧文件';
      const res = await upload(server, token, {
        name: '回归.md',
        content: Buffer.from(`\uFEFF${content}`),
      });
      const doc = res.body as DocumentDto;

      const row = await documentRow(doc.id);
      expect(row).not.toBeNull();
      // 与改造前一致：BOM 剥离，其余逐字节保留
      expect(row!.content).toBe(content);
      expect(row!.status).toBe('ready');
      expect(row!.failure_reason).toBeNull();
    });

    it('.txt → 202 且收敛 ready', async () => {
      const res = await upload(server, token, {
        name: 'readme.txt',
        content: Buffer.from('plain text'),
        contentType: 'text/plain',
      });

      expect(res.status).toBe(202);
      const doc = res.body as DocumentDto;
      expect(doc.title).toBe('readme');
      expect(doc.status).toBe('processing');
      const docs = await listDocs(server, token);
      expect(docs[0].status).toBe('ready');
    });

    it('中文文件名 → 标题保留 UTF-8 原文（不乱码）', async () => {
      const res = await upload(server, token, {
        name: '验收文档.md',
        content: Buffer.from('内容'),
      });

      expect(res.status).toBe(202);
      const doc = res.body as DocumentDto;
      expect(doc.title).toBe('验收文档');
    });

    it('大写扩展名 .MD → 202，标题仍剥离扩展名', async () => {
      const res = await upload(server, token, {
        name: 'NOTE.MD',
        content: Buffer.from('note'),
      });

      expect(res.status).toBe(202);
      const doc = res.body as DocumentDto;
      expect(doc.title).toBe('NOTE');
    });

    it('空文件 → 202 且收敛 ready', async () => {
      const res = await upload(server, token, {
        name: '空.md',
        content: Buffer.alloc(0),
      });

      expect(res.status).toBe(202);
      const docs = await listDocs(server, token);
      expect(docs[0].status).toBe('ready');
    });

    it('2 MiB 减 1 字节 → 202（当前实际接受的上限）', async () => {
      const res = await upload(server, token, {
        name: 'max.md',
        content: Buffer.alloc(UPLOAD_MAX_BYTES - 1, 'a'),
      });

      expect(res.status).toBe(202);
      const docs = await listDocs(server, token);
      expect(docs[0].status).toBe('ready');
    });

    // 语义变更（issue #4）：multer 上限上移到 PDF 档（20 MiB），md/txt 的 2 MiB
    // 档改由服务层判定——含边界（恰好 2 MiB 接受）；busboy「到达即拒」的
    // off-by-one 只保留在 PDF 档（见 pdf-ingestion spec）。
    it('恰好 2 MiB → 202（服务层含边界判定）', async () => {
      const res = await upload(server, token, {
        name: 'exact.md',
        content: Buffer.alloc(UPLOAD_MAX_BYTES, 'a'),
      });

      expect(res.status).toBe(202);
    });

    it('缺 file 字段 → 400 且带明确原因', async () => {
      const res = await request(server)
        .post('/documents')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('缺少 file 字段');
    });
  });

  describe('上传校验：违规一律 400', () => {
    it('md/txt 超过 2 MiB（服务层判定）→ 400 且带明确原因（而非 413）', async () => {
      const res = await upload(server, token, {
        name: 'big.md',
        content: Buffer.alloc(UPLOAD_MAX_BYTES + 1, 'a'),
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('文件大小超过上限');
      expect(errorMessage(res)).toContain('md / .txt');
    });

    it('md/txt 内容非法 UTF-8（魔数嗅探的文本档等价物）→ 400', async () => {
      const res = await upload(server, token, {
        name: 'binary.md',
        content: Buffer.from([0xff, 0xfe, 0x00, 0xd8, 0xff]),
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('UTF-8');
    });

    it('.png 扩展名 → 400 拒绝', async () => {
      const res = await upload(server, token, {
        name: 'photo.png',
        content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        contentType: 'image/png',
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('仅支持 .md / .txt');
    });

    it('.md 文件名但 MIME 为 application/pdf → 400（MIME 冲突）', async () => {
      const res = await upload(server, token, {
        name: '伪装.md',
        content: Buffer.from('%PDF-1.4'),
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('仅支持 .md / .txt');
    });
  });

  describe('文档列表', () => {
    it('空库 → 200 且返回 []', async () => {
      const res = await request(server)
        .get('/documents')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('含已上传文档 → 200，按创建时间倒序，行形状与上传响应一致', async () => {
      await upload(server, token, {
        name: '第一篇.md',
        content: Buffer.from('a'),
      });
      await upload(server, token, {
        name: '第二篇.txt',
        content: Buffer.from('b'),
        contentType: 'text/plain',
      });

      const res = await request(server)
        .get('/documents')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const docs = res.body as DocumentDto[];
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.title)).toEqual(['第二篇', '第一篇']);
      expect(docs.every((d) => d.status === 'ready')).toBe(true);
      for (const d of docs) {
        expect(Object.keys(d).sort()).toEqual(DOC_KEYS);
        expect(d.failure_reason).toBeNull();
      }
    });
  });

  describe('删除', () => {
    it('删除已存在文档 → 204 空响应，列表不再可见', async () => {
      const created = await upload(server, token, {
        name: '待删.md',
        content: Buffer.from('x'),
      });
      const doc = created.body as DocumentDto;

      const del = await request(server)
        .delete(`/documents/${doc.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);
      expect(del.text).toBe('');

      const list = await request(server)
        .get('/documents')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body).toEqual([]);
    });

    it('id 非法（非 UUID）→ 400', async () => {
      const res = await request(server)
        .delete('/documents/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});

// documents 域现有契约钉住（issue #2）：同步摄取下 md/txt 上传即 200 + ready、
// 列表、删除、大小/扩展名/MIME 违规 400。ADR 0001 的异步化改造落地时，这些
// 断言的调整必须是显式的契约变更，而不是静默漂移。
import type { Server } from 'node:http';
import request from 'supertest';
import type { DocumentDto } from '@kh/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UUID_RE, UPLOAD_MAX_BYTES, errorMessage, upload } from './fixtures';
import { getAccessToken, resetData, startApp, stopApp } from './harness';

// 响应体 cast 说明：断言即校验——cast 到契约形状只为逐字段断言服务，
// 形状不符时下方断言立即失败，不存在静默读错。

describe('documents 契约（现有同步摄取）', () => {
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

  describe('上传 md/txt：200 且 ready（同步摄取契约）', () => {
    it('.md → 200 且 ready，响应形状恰为 id/title/status/created_at', async () => {
      const res = await upload(server, token, {
        name: '笔记.md',
        content: Buffer.from('# 标题\n\n正文'),
      });

      expect(res.status).toBe(200);
      const doc = res.body as DocumentDto;
      // 键集合严格钉住：content 等内部字段不得外泄
      expect(Object.keys(doc).sort()).toEqual([
        'created_at',
        'id',
        'status',
        'title',
      ]);
      expect(doc.id).toMatch(UUID_RE);
      expect(doc.title).toBe('笔记');
      expect(doc.status).toBe('ready');
      expect(Number.isNaN(Date.parse(doc.created_at))).toBe(false);
    });

    it('.txt → 200 且 ready', async () => {
      const res = await upload(server, token, {
        name: 'readme.txt',
        content: Buffer.from('plain text'),
        contentType: 'text/plain',
      });

      expect(res.status).toBe(200);
      const doc = res.body as DocumentDto;
      expect(doc.title).toBe('readme');
      expect(doc.status).toBe('ready');
    });

    it('中文文件名 → 标题保留 UTF-8 原文（不乱码）', async () => {
      const res = await upload(server, token, {
        name: '验收文档.md',
        content: Buffer.from('内容'),
      });

      expect(res.status).toBe(200);
      const doc = res.body as DocumentDto;
      expect(doc.title).toBe('验收文档');
    });

    it('大写扩展名 .MD → 200，标题仍剥离扩展名', async () => {
      const res = await upload(server, token, {
        name: 'NOTE.MD',
        content: Buffer.from('note'),
      });

      expect(res.status).toBe(200);
      const doc = res.body as DocumentDto;
      expect(doc.title).toBe('NOTE');
    });

    it('空文件 → 200 且 ready', async () => {
      const res = await upload(server, token, {
        name: '空.md',
        content: Buffer.alloc(0),
      });

      expect(res.status).toBe(200);
      const doc = res.body as DocumentDto;
      expect(doc.status).toBe('ready');
    });

    it('2 MiB 减 1 字节 → 200（当前实际接受的上限）', async () => {
      const res = await upload(server, token, {
        name: 'max.md',
        content: Buffer.alloc(UPLOAD_MAX_BYTES - 1, 'a'),
      });

      expect(res.status).toBe(200);
      const doc = res.body as DocumentDto;
      expect(doc.status).toBe('ready');
    });

    // 现状钉住：multer 2.x / busboy 1.6 对 fileSize 上限是「到达即拒」语义，
    // 恰好 UPLOAD_MAX_BYTES 字节也被拒（文案「≤ N 字节」因此有 1 字节误差）。
    // 若未来修正为含边界，此处断言应显式更新。
    it('恰好 2 MiB → 400（busboy 到达上限即拒，现状 off-by-one）', async () => {
      const res = await upload(server, token, {
        name: 'exact.md',
        content: Buffer.alloc(UPLOAD_MAX_BYTES, 'a'),
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('文件大小超过上限');
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
    it('超过 2 MiB → 400 且带明确原因（而非 413）', async () => {
      const res = await upload(server, token, {
        name: 'big.md',
        content: Buffer.alloc(UPLOAD_MAX_BYTES + 1, 'a'),
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('文件大小超过上限');
    });

    it('.pdf 扩展名 → 400 拒绝', async () => {
      const res = await upload(server, token, {
        name: '论文.pdf',
        content: Buffer.from('%PDF-1.4'),
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(400);
      expect(errorMessage(res)).toContain('仅支持 .md / .txt');
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
        expect(Object.keys(d).sort()).toEqual([
          'created_at',
          'id',
          'status',
          'title',
        ]);
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

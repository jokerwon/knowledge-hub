import { createServer, type Server, type ServerResponse } from 'node:http';

export interface FakeRustfsObject {
  bytes: Buffer;
  contentType: string | undefined;
}

export interface FakeRustfs {
  server: Server;
  url: string;
  objects: Map<string, FakeRustfsObject>;
  bucketExists: boolean;
  policy: string | null;
  close(): Promise<void>;
}

export async function startFakeRustfs(): Promise<FakeRustfs> {
  const objects = new Map<string, FakeRustfsObject>();
  const fake: FakeRustfs = {
    server: null as unknown as Server,
    url: '',
    objects,
    bucketExists: false,
    policy: null,
    close: () => new Promise((resolve) => fake.server.close(() => resolve())),
  };
  fake.server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://rustfs.test');
      // SDK 对 bucket 根路径请求带尾斜杠（/knowledge-hub/），统一剥掉再匹配
      const pathname = url.pathname.replace(/\/+$/, '') || '/';
      const bucketRoot = pathname === '/knowledge-hub';
      const policyOp = url.searchParams.has('policy');

      if (req.method === 'HEAD' && bucketRoot && !policyOp) {
        res.statusCode = fake.bucketExists ? 200 : 404;
        res.end();
        return;
      }
      // GetBucketPolicy：无策略返回 S3 风格 NoSuchBucketPolicy 错误体
      if (req.method === 'GET' && bucketRoot && policyOp) {
        if (fake.policy === null) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/xml');
          res.end(
            '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchBucketPolicy</Code></Error>',
          );
          return;
        }
        respondXml(res, 200, fake.policy);
        return;
      }
      // PutBucketPolicy（?policy=）/ CreateBucket（bucket 根路径）
      if (req.method === 'PUT' && bucketRoot) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (policyOp) {
          fake.policy = Buffer.concat(chunks).toString('utf8');
        } else {
          fake.bucketExists = true;
        }
        res.statusCode = 200;
        res.end();
        return;
      }
      if (req.method !== 'PUT' || !req.url) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      objects.set(pathname, {
        bytes: Buffer.concat(chunks),
        contentType: req.headers['content-type'],
      });
      res.statusCode = 200;
      res.end();
    })().catch((err) => {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.message : String(err));
    });
  });

  const { promise, resolve } = Promise.withResolvers<void>();
  fake.server.listen(0, '127.0.0.1', resolve);
  await promise;
  const address = fake.server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('fake RustFS 监听失败');
  }
  fake.url = `http://127.0.0.1:${address.port}`;
  return fake;
}

function respondXml(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/xml');
  res.end(body);
}

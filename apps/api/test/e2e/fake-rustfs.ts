import { createServer, type Server } from 'node:http';

export interface FakeRustfsObject {
  bytes: Buffer;
  contentType: string | undefined;
}

export interface FakeRustfs {
  server: Server;
  url: string;
  objects: Map<string, FakeRustfsObject>;
  bucketExists: boolean;
}

export async function startFakeRustfs(): Promise<FakeRustfs> {
  const objects = new Map<string, FakeRustfsObject>();
  const fake: FakeRustfs = {
    server: null as unknown as Server,
    url: '',
    objects,
    bucketExists: false,
    close: () => new Promise((resolve) => fake.server.close(() => resolve())),
  };
  fake.server = createServer((req, res) => {
    void (async () => {
      const pathname = new URL(req.url ?? '/', 'http://rustfs.test').pathname;
      if (req.method === 'HEAD' && pathname === '/knowledge-hub') {
        res.statusCode = fake.bucketExists ? 200 : 404;
        res.end();
        return;
      }
      if (req.method === 'PUT' && pathname === '/knowledge-hub') {
        fake.bucketExists = true;
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

// fake MinerU：进程内 node:http server，实现被测客户端用到的官方端点子集
// （批次申请 / 预签名上传 / 批次结果轮询 / 结果包下载）。测试直接改内存里的
// task 对象驱动剧本（state/err_msg/markdown），MinerU 在其 HTTP 网络边界 fake。
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { crc32, deflateRawSync } from 'node:zlib';

export type FakeMineruState =
  'waiting-file' | 'pending' | 'running' | 'converting' | 'done' | 'failed';

export interface FakeMineruTask {
  batchId: string;
  fileName: string;
  dataId: string | null;
  uploadedBytes: Buffer | null;
  state: FakeMineruState;
  errMsg: string;
  // running 期进度（页数上限判定用）；done 期忽略
  totalPages: number | null;
  // done 期结果包内 full.md 的内容
  markdown: string;
  // 结果包物理布局：false = stored（method 0），true = deflate（method 8）
  zipDeflated: boolean;
}

export interface FakeMineru {
  server: Server;
  url: string;
  tasks: Map<string, FakeMineruTask>;
  // 全局故障开关：非 null 时对应端点直接返回该状态码（模拟服务故障）
  failCreateStatus: number | null;
  failPollStatus: number | null;
  close(): Promise<void>;
  // 恢复测试播种：不经 HTTP 直接在任务表放入已知 batchId 的任务
  createTask(init: { batchId: string; fileName?: string }): FakeMineruTask;
}

export async function startFakeMineru(): Promise<FakeMineru> {
  const tasks = new Map<string, FakeMineruTask>();
  const fake: FakeMineru = {
    server: null as unknown as Server,
    url: '',
    tasks,
    failCreateStatus: null,
    failPollStatus: null,
    close: () => new Promise((resolve) => fake.server.close(() => resolve())),
    createTask: (init: { batchId: string; fileName?: string }) => {
      const task: FakeMineruTask = {
        batchId: init.batchId,
        fileName: init.fileName ?? 'recovered.pdf',
        dataId: null,
        uploadedBytes: Buffer.alloc(0),
        state: 'pending',
        errMsg: '',
        totalPages: null,
        markdown: '',
        zipDeflated: true,
      };
      fake.tasks.set(init.batchId, task);
      return task;
    },
  };

  const server = createServer((req, res) => {
    void handle(req, res, fake).catch((err) => {
      res.statusCode = 500;
      res.end(String(err instanceof Error ? err.message : err));
    });
  });
  fake.server = server;

  const { promise, resolve } = Promise.withResolvers<void>();
  server.listen(0, '127.0.0.1', resolve);
  await promise;
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('fake mineru 监听失败');
  }
  fake.url = `http://127.0.0.1:${address.port}`;
  return fake;
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  fake: FakeMineru,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://mineru.local');

  // 1. 批次申请：POST /api/v4/file-urls/batch
  if (req.method === 'POST' && url.pathname === '/api/v4/file-urls/batch') {
    if (fake.failCreateStatus !== null) {
      res.statusCode = fake.failCreateStatus;
      res.end('mineru create outage');
      return;
    }
    // 请求体是外部输入：守卫式读取（与 src 侧响应体处理同一哲学）
    const body: unknown = JSON.parse((await readBody(req)).toString('utf8'));
    const files =
      body !== null &&
      typeof body === 'object' &&
      'files' in body &&
      Array.isArray(body.files)
        ? (body as { files: unknown[] }).files
        : [];
    const entry = files[0] as Record<string, unknown> | undefined;
    const batchId = randomUUID();
    const task: FakeMineruTask = {
      batchId,
      fileName: typeof entry?.name === 'string' ? entry.name : 'unknown.pdf',
      dataId: typeof entry?.data_id === 'string' ? entry.data_id : null,
      uploadedBytes: null,
      state: 'waiting-file',
      errMsg: '',
      totalPages: null,
      markdown: '',
      zipDeflated: true,
    };
    fake.tasks.set(batchId, task);
    respondJson(res, 200, {
      code: 0,
      msg: 'ok',
      data: { batch_id: batchId, file_urls: [`${fake.url}/upload/${batchId}`] },
    });
    return;
  }

  // 2. 预签名上传：PUT /upload/:batchId（官方约定不带 Content-Type）
  const uploadMatch = url.pathname.match(/^\/upload\/([0-9a-f-]+)$/);
  if (req.method === 'PUT' && uploadMatch) {
    const task = fake.tasks.get(uploadMatch[1]);
    if (!task) {
      res.statusCode = 404;
      res.end();
      return;
    }
    task.uploadedBytes = await readBody(req);
    // 官方语义：上传完成后系统自动提交解析任务
    task.state = 'pending';
    res.statusCode = 200;
    res.end();
    return;
  }

  // 3. 批次结果轮询：GET /api/v4/extract-results/batch/:batchId
  const pollMatch = url.pathname.match(
    /^\/api\/v4\/extract-results\/batch\/([0-9a-f-]+)$/,
  );
  if (req.method === 'GET' && pollMatch) {
    if (fake.failPollStatus !== null) {
      res.statusCode = fake.failPollStatus;
      res.end('mineru poll outage');
      return;
    }
    const task = fake.tasks.get(pollMatch[1]);
    if (!task) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const result: Record<string, unknown> = {
      file_name: task.fileName,
      state: task.state,
      err_msg: task.errMsg,
    };
    if (task.state === 'running' && task.totalPages !== null) {
      result.extract_progress = {
        extracted_pages: 1,
        total_pages: task.totalPages,
      };
    }
    if (task.state === 'done') {
      result.full_zip_url = `${fake.url}/results/${task.batchId}`;
    }
    respondJson(res, 200, {
      code: 0,
      msg: 'ok',
      data: { batch_id: task.batchId, extract_result: [result] },
    });
    return;
  }

  // 4. 结果包下载：GET /results/:batchId → 含 full.md 的 zip
  const resultMatch = url.pathname.match(/^\/results\/([0-9a-f-]+)$/);
  if (req.method === 'GET' && resultMatch) {
    const task = fake.tasks.get(resultMatch[1]);
    if (!task) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.end(buildMineruResultZip(task.markdown, { deflate: task.zipDeflated }));
    return;
  }

  res.statusCode = 404;
  res.end();
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  // IncomingMessage 的异步迭代按 any 产出：先收敛到 Buffer | string 再收窄
  const parts: AsyncIterable<Buffer | string> = req;
  for await (const part of parts) {
    chunks.push(typeof part === 'string' ? Buffer.from(part, 'utf8') : part);
  }
  return Buffer.concat(chunks);
}

// 手写最小 zip（stored 与 deflate 两种条目）：MinerU 结果包即标准 zip，
// full.md 是唯一被消费的条目。deflate 变体用于覆盖解压路径。
export function buildMineruResultZip(
  markdown: string,
  options: { deflate?: boolean } = {},
): Buffer {
  return buildZip(
    [{ name: 'full.md', data: Buffer.from(markdown, 'utf8') }],
    options,
  );
}

export function buildZip(
  entries: Array<{ name: string; data: Buffer }>,
  options: { deflate?: boolean } = {},
): Buffer {
  const deflate = options.deflate ?? true;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const method = deflate ? 8 : 0;
    const payload = deflate ? deflateRawSync(entry.data) : entry.data;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // mtime
    local.writeUInt16LE(0x21, 12); // mdate（任意固定值）
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += 30 + nameBytes.length + payload.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralDir, eocd]);
}

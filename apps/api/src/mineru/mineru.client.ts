import { Injectable, Logger } from '@nestjs/common';
import { extractZipEntry } from './zip';

// MinerU 官方云 API 客户端（ADR 0001 决策 1）：本地文件走批次上传通道——
// 申请上传 URL → PUT 原始字节（系统自动提交解析任务）→ 按 batch_id 轮询 →
// 下载结果 zip 取 full.md。端点与响应结构以 2026-09 官方文档为准：
// https://mineru.net/apiManage/docs（Open API / 精确解析 / 单文件与批量）。
//
// 本模块只做传输与形状解析，不做状态机决策（终态判定在 IngestionService）。

const DEFAULT_API_BASE = 'https://mineru.net';
const REQUEST_TIMEOUT_MS = 30_000;
const FULL_MD_ENTRY = 'full.md';

// 批次任务快照：MinerU 的 state 集合（waiting-file/pending/running/converting
// 均视为在途）。totalPages 来自 running 期进度，done 期不返回。
export interface MineruSnapshot {
  state:
    'waiting-file' | 'pending' | 'running' | 'converting' | 'done' | 'failed';
  errMsg: string;
  totalPages: number | null;
  fullZipUrl: string | null;
}

@Injectable()
export class MineruClient {
  private readonly logger = new Logger(MineruClient.name);
  private readonly apiBase: string;
  private readonly token: string;

  constructor() {
    // MINERU_API_TOKEN 必填（issue #1 配置决策）：缺失时 fail-fast，
    // 不允许带病启动到第一次 PDF 上传才炸。
    const token = process.env.MINERU_API_TOKEN;
    if (!token) {
      throw new Error(
        'MINERU_API_TOKEN 未配置：请在 .env 配置 MinerU API token',
      );
    }
    this.token = token;
    this.apiBase = (process.env.MINERU_API_BASE ?? DEFAULT_API_BASE).replace(
      /\/+$/,
      '',
    );
  }

  // 提交本地文件：返回批次号（存 documents.mineru_task_id，启动恢复凭它续轮询）。
  async submitFile(
    fileName: string,
    bytes: Buffer,
    dataId: string,
  ): Promise<string> {
    const created = await this.postJson<{
      batch_id: string;
      file_urls: string[];
    }>('/api/v4/file-urls/batch', {
      // 单文件批次；data_id 用文档 id，便于结果侧对账
      files: [{ name: fileName, data_id: dataId }],
      model_version: 'vlm',
    });
    const uploadUrl = created.file_urls[0];
    if (!uploadUrl) {
      throw new Error('MinerU 未返回上传 URL');
    }

    // 预签名 URL 直传：官方要求不携带 Content-Type（也不带 Authorization——
    // 目标是对象存储而非 MinerU 网关，带 token 反而外泄）。
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      // 拷贝出 ArrayBuffer 底层的视图：@types/node 的 Buffer 底层是
      // ArrayBufferLike，与 undici BodyInit 的 Uint8Array<ArrayBuffer> 不兼容
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!put.ok) {
      throw new Error(`文件上传至 MinerU 失败：HTTP ${put.status}`);
    }
    return created.batch_id;
  }

  // 查询批次任务状态。HTTP / code 非 0 / 形状意外均抛错（调用方按瞬时故障计）。
  async getBatchResult(batchId: string): Promise<MineruSnapshot> {
    const data = await this.getJson<{
      extract_result?: Array<{
        state?: unknown;
        err_msg?: unknown;
        full_zip_url?: unknown;
        extract_progress?: { total_pages?: unknown };
      }>;
    }>(`/api/v4/extract-results/batch/${batchId}`);

    // 单文件批次取首个条目；服务端尚未登记条目时视为在途
    const entry = data.extract_result?.[0];
    if (!entry) {
      return {
        state: 'pending',
        errMsg: '',
        totalPages: null,
        fullZipUrl: null,
      };
    }
    return {
      state: parseState(entry.state),
      errMsg: typeof entry.err_msg === 'string' ? entry.err_msg : '',
      totalPages:
        typeof entry.extract_progress?.total_pages === 'number'
          ? entry.extract_progress.total_pages
          : null,
      fullZipUrl:
        typeof entry.full_zip_url === 'string' ? entry.full_zip_url : null,
    };
  }

  // 下载结果 zip 并取出 full.md（Markdown 正文）。提取的图片资源按 ADR 决策 10 丢弃。
  async fetchMarkdown(fullZipUrl: string): Promise<string> {
    const res = await fetch(fullZipUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`下载 MinerU 结果包失败：HTTP ${res.status}`);
    }
    const zip = Buffer.from(await res.arrayBuffer());
    return extractZipEntry(zip, FULL_MD_ENTRY).toString('utf8');
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`MinerU ${path} 失败：HTTP ${res.status}`);
    }
    return unwrapData<T>(await res.json(), path);
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`MinerU ${path} 失败：HTTP ${res.status}`);
    }
    return unwrapData<T>(await res.json(), path);
  }
}

// MinerU 响应包络 { code, msg, data }：code 非 0 是语义失败（限流/配额/无效 token）。
function unwrapData<T>(body: unknown, path: string): T {
  if (
    !body ||
    typeof body !== 'object' ||
    !('code' in body) ||
    !('data' in body)
  ) {
    throw new Error(
      `MinerU ${path} 响应形状意外：${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  const envelope = body as { code: unknown; msg: unknown; data: unknown };
  if (envelope.code !== 0) {
    throw new Error(
      `MinerU ${path} 返回错误：code=${String(envelope.code)} msg=${String(envelope.msg)}`,
    );
  }
  return envelope.data as T;
}

function parseState(state: unknown): MineruSnapshot['state'] {
  switch (state) {
    case 'waiting-file':
    case 'pending':
    case 'running':
    case 'converting':
    case 'done':
    case 'failed':
      return state;
    default:
      throw new Error(`MinerU 返回未知任务状态：${JSON.stringify(state)}`);
  }
}

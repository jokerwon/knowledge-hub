import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetBucketPolicyCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import type { AppConfig } from '../config';

export interface ImageAsset {
  name: string;
  data: Buffer;
}

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

@Injectable()
export class RustfsService {
  private readonly enabled: boolean;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly client: S3Client | null;
  private bucketReady: Promise<void> | null = null;

  constructor(config: ConfigService<AppConfig>) {
    const cfg = config.getOrThrow('rustfs', { infer: true });
    this.enabled = cfg.enabled;
    this.bucket = cfg.bucket;
    this.publicUrl = cfg.publicUrl;

    if (!cfg.enabled) {
      this.client = null;
      return;
    }
    if (!cfg.accessKey || !cfg.secretKey) {
      throw new Error(
        'RustFS 已启用但凭据未配置：请配置 RUSTFS_ACCESS_KEY 和 RUSTFS_SECRET_KEY',
      );
    }
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
    });
  }

  private async ensureBucket(): Promise<void> {
    if (!this.client) throw new Error('RustFS 客户端未初始化');
    if (!this.bucketReady) {
      this.bucketReady = this.ensureBucketExists().catch((err) => {
        this.bucketReady = null;
        throw err;
      });
    }
    await this.bucketReady;
  }

  private async ensureBucketExists(): Promise<void> {
    if (!this.client) throw new Error('RustFS 客户端未初始化');
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      await this.ensurePublicReadPolicy();
      return;
    } catch (err) {
      if (
        !(err instanceof S3ServiceException) ||
        err.$metadata.httpStatusCode !== 404
      ) {
        throw err;
      }
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (
        !(err instanceof S3ServiceException) ||
        (err.name !== 'BucketAlreadyExists' &&
          err.name !== 'BucketAlreadyOwnedByYou')
      ) {
        throw err;
      }
    }
    await this.ensurePublicReadPolicy();
  }

  // 图片 URL 直接供浏览器访问（ADR 0002 决策 3）：bucket 需要匿名 GetObject。
  // 已有策略时不覆盖（运维可能收紧过）；无策略时写入限定 documents/* 的最小授权。
  private async ensurePublicReadPolicy(): Promise<void> {
    if (!this.client) throw new Error('RustFS 客户端未初始化');
    try {
      await this.client.send(
        new GetBucketPolicyCommand({ Bucket: this.bucket }),
      );
      return;
    } catch (err) {
      // NoSuchBucketPolicy = 可写；其他错误（权限不足等）照常上抛
      if (
        !(err instanceof S3ServiceException) ||
        err.name !== 'NoSuchBucketPolicy'
      ) {
        throw err;
      }
    }
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/documents/*`],
        },
      ],
    });
    await this.client.send(
      new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: policy }),
    );
  }

  async uploadImages(
    docId: string,
    assets: ImageAsset[],
  ): Promise<Map<string, string>> {
    if (assets.length === 0) return new Map();
    if (!this.enabled || !this.client) {
      throw new Error('PDF 包含图片但 RustFS 未启用');
    }

    await this.ensureBucket();
    const urls = new Map<string, string>();
    for (const [index, asset] of assets.entries()) {
      const extension = extensionOf(asset.name);
      const fileName = `${index + 1}-${safeBaseName(asset.name)}${extension}`;
      const key = `documents/${docId}/${fileName}`;
      const input: PutObjectCommandInput = {
        Bucket: this.bucket,
        Key: key,
        Body: asset.data,
        ContentType: IMAGE_TYPES[extension],
      };
      await this.client.send(new PutObjectCommand(input));
      urls.set(normalizeAssetName(asset.name), this.publicObjectUrl(key));
    }
    return urls;
  }

  private publicObjectUrl(key: string): string {
    return `${this.publicUrl}/${encodeURIComponent(this.bucket)}/${key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`;
  }
}

export function isSupportedImageName(name: string): boolean {
  return extensionOf(name) in IMAGE_TYPES;
}

export function normalizeAssetName(name: string): string {
  return name.replaceAll('\\', '/').replace(/^\.\//, '');
}

function extensionOf(name: string): string {
  const normalized = normalizeAssetName(name);
  const dot = normalized.lastIndexOf('.');
  return dot >= 0 ? normalized.slice(dot).toLowerCase() : '';
}

function safeBaseName(name: string): string {
  const normalized = normalizeAssetName(name);
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  const withoutExtension = base.replace(/\.[^.]*$/, '');
  const safe = withoutExtension
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return safe || 'image';
}

import { BadRequestException } from '@nestjs/common';
import * as path from 'node:path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { AppConfig } from '../config';

export const UPLOAD_FIELD = 'file';

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.pdf'];

// curl 与浏览器对 .md 常发 application/octet-stream；空 MIME 视为未知。
// 双校验：扩展名必须命中白名单，且 MIME 不得与扩展名档位冲突
// （文本扩展名配 application/pdf、.pdf 配 text/* 均直接拒绝）。
const isAllowedMime = (ext: string, mime: string): boolean => {
  if (mime === '' || mime === 'application/octet-stream') return true;
  if (ext === '.pdf') {
    return mime === 'application/pdf' || mime === 'application/x-pdf';
  }
  return mime.startsWith('text/');
};

// multer 选项：fileSize 按 PDF 档（决策 7——分层上限的最大档）设置；
// md/txt 超 2 MiB 在服务层按文本档判定后 400（documents.service）。
// DocumentsModule 经 registerAsync 注入 ConfigService 后调用。
export function buildUploadOptions(upload: AppConfig['upload']): MulterOptions {
  return {
    // busboy 默认按 latin1 解码 multipart 文件名参数，非 ASCII 文件名会存成乱码
    // （如「验收文档」→「éªæ¶ææ¡£」）；本系统的客户端一律发送 UTF-8 文件名。
    defParamCharset: 'utf8',
    limits: {
      fileSize: upload.pdfMaxBytes,
    },
    fileFilter: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (
        ALLOWED_EXTENSIONS.includes(ext) &&
        isAllowedMime(ext, file.mimetype)
      ) {
        return callback(null, true);
      }
      callback(
        new BadRequestException(
          `仅支持 .md / .txt / .pdf 文件：收到 ${file.originalname}（${file.mimetype || '未知 MIME'}）`,
        ),
        false,
      );
    },
  };
}

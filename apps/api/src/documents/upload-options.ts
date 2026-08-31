import { BadRequestException } from '@nestjs/common';
import * as path from 'node:path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { DEFAULT_MAX_UPLOAD_BYTES } from '@kh/shared';
import { cfgInt } from '../config';

export const UPLOAD_FIELD = 'file';

const ALLOWED_EXTENSIONS = ['.md', '.txt'];

// curl 与浏览器对 .md 常发 application/octet-stream；空 MIME 视为未知。
// 双校验：扩展名必须命中白名单，且 MIME 不得与文本类型冲突（如 application/pdf 直接拒绝）。
const isAllowedMime = (mime: string): boolean =>
  mime === '' ||
  mime.startsWith('text/') ||
  mime === 'application/octet-stream';

// multer 选项：fileSize 跟随 UPLOAD_MAX_BYTES。
export function buildUploadOptions(): MulterOptions {
  return {
    limits: {
      fileSize: cfgInt('UPLOAD_MAX_BYTES', DEFAULT_MAX_UPLOAD_BYTES),
    },
    fileFilter: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(ext) && isAllowedMime(file.mimetype)) {
        return callback(null, true);
      }
      callback(
        new BadRequestException(
          `仅支持 .md / .txt 文件：收到 ${file.originalname}（${file.mimetype || '未知 MIME'}）`,
        ),
        false,
      );
    },
  };
}

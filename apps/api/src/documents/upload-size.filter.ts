import {
  ExceptionFilter,
  Catch,
  ExecutionContext,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { DEFAULT_MAX_UPLOAD_BYTES } from '@kh/shared';
import { cfgInt } from '../config';

// multer 超限原生为 413；计划要求违规一律 400 且响应体带明确原因。
@Catch(PayloadTooLargeException)
export class UploadSizeFilter implements ExceptionFilter {
  private readonly uploadMaxBytes: number;

  constructor(cfg: ConfigService) {
    this.uploadMaxBytes = cfgInt(
      cfg,
      'UPLOAD_MAX_BYTES',
      DEFAULT_MAX_UPLOAD_BYTES,
    );
  }

  catch(_exception: PayloadTooLargeException, host: ExecutionContext): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `文件大小超过上限（≤ ${this.uploadMaxBytes} 字节）`,
        error: 'Bad Request',
      });
  }
}

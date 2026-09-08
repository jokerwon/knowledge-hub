import {
  ExceptionFilter,
  Catch,
  ExecutionContext,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AppConfig } from '../config';

// multer 超限原生为 413；契约要求违规一律 400 且响应体带明确原因。
// multer 上限按 PDF 档设置，此处的超限必然是超过了 PDF 上限（> 20 MiB）；
// md/txt 的 2 MiB 档超限不会走到这里（服务层按文本档判定）。
@Catch(PayloadTooLargeException)
export class UploadSizeFilter implements ExceptionFilter {
  private readonly textMaxBytes: number;
  private readonly pdfMaxBytes: number;

  constructor(config: ConfigService<AppConfig>) {
    const upload = config.getOrThrow('upload', { infer: true });
    this.textMaxBytes = upload.textMaxBytes;
    this.pdfMaxBytes = upload.pdfMaxBytes;
  }

  catch(_exception: PayloadTooLargeException, host: ExecutionContext): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `文件大小超过上限（.md/.txt ≤ ${this.textMaxBytes} 字节，.pdf ≤ ${this.pdfMaxBytes} 字节）`,
        error: 'Bad Request',
      });
  }
}

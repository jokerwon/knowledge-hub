import {
  ExceptionFilter,
  Catch,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';
import { config } from '../config';

// multer 超限原生为 413；计划要求违规一律 400 且响应体带明确原因。
@Catch(PayloadTooLargeException)
export class UploadSizeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ExecutionContext): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `文件大小超过上限（≤ ${config.uploadMaxBytes} 字节）`,
        error: 'Bad Request',
      });
  }
}

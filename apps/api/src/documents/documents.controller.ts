import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DocumentDto } from '@kh/shared';
import { DocumentsService } from './documents.service';
import { UPLOAD_FIELD, UPLOAD_OPTIONS } from './upload-options';
import { UploadSizeFilter } from './upload-size.filter';

@Controller('documents')
@UseFilters(UploadSizeFilter)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // 同步摄取（ADR-0008）：响应即最终结果，200 表示 ready。
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor(UPLOAD_FIELD, UPLOAD_OPTIONS))
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentDto> {
    if (!file) {
      throw new BadRequestException(
        '缺少 file 字段：请以 multipart 上传 .md / .txt 文件',
      );
    }
    return this.documentsService.ingestUpload(file);
  }

  @Get()
  list(): Promise<DocumentDto[]> {
    return this.documentsService.list();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.documentsService.remove(id);
  }
}

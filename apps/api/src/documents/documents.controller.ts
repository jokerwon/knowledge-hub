import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DocumentDto } from '@kh/shared';
import { DocumentsService } from './documents.service';
import { UPLOAD_FIELD } from './upload-options';
import { UploadSizeFilter } from './upload-size.filter';

@Controller('documents')
@UseFilters(UploadSizeFilter)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // 同步摄取（ADR-0008）：响应即最终结果，200 表示 ready。
  // multer 选项（大小上限、扩展名白名单）在 DocumentsModule 经
  // MulterModule.registerAsync 注册为默认值，此处不再传第二参。
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor(UPLOAD_FIELD))
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
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.documentsService.remove(id);
  }
}

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './entities/document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { buildUploadOptions } from './upload-options';
import { UploadSizeFilter } from './upload-size.filter';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    // multer 默认选项（大小上限跟随 UPLOAD_MAX_BYTES），FileInterceptor 不再传 options。
    MulterModule.register(buildUploadOptions()),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, UploadSizeFilter],
})
export class DocumentsModule {}

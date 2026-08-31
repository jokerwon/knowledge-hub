import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChunkEntity } from './entities/chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import {
  DocumentContent,
  DocumentContentSchema,
} from './schemas/document-content.schema';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { buildUploadOptions } from './upload-options';
import { UploadSizeFilter } from './upload-size.filter';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, ChunkEntity]),
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
    // multer 默认选项由配置异步注册（大小上限跟随 UPLOAD_MAX_BYTES），
    // FileInterceptor 不再传 options。
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: buildUploadOptions,
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, UploadSizeFilter],
})
export class DocumentsModule {}

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChunkEntity } from './entities/chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import {
  DocumentContent,
  DocumentContentSchema,
} from './schemas/document-content.schema';
import { APP_CONFIG, AppConfigProviderModule } from '../config';
import { IngestModule } from '../ingest/ingest.module';
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
    // multer 默认选项由配置异步注册（uploadMaxBytes 跟随 APP_CONFIG），
    // FileInterceptor 不再传 options。
    MulterModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: buildUploadOptions,
    }),
    AppConfigProviderModule,
    IngestModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, UploadSizeFilter],
})
export class DocumentsModule {}

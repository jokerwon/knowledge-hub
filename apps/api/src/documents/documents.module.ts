import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../config';
import { MineruModule } from '../mineru/mineru.module';
import { RustfsModule } from '../storage/rustfs.module';
import { DocumentEntity } from './entities/document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { IngestionService } from './ingestion.service';
import { buildUploadOptions } from './upload-options';
import { UploadSizeFilter } from './upload-size.filter';
import { INGESTION_CLOCK, SystemClock } from './clock';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    // multer 默认选项（大小上限按 PDF 档、扩展名白名单），FileInterceptor 不再传 options；
    // 上限来自统一配置，registerAsync 在 DI 期解析。
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) =>
        buildUploadOptions(config.getOrThrow('upload', { infer: true })),
    }),
    RustfsModule,
    MineruModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    IngestionService,
    UploadSizeFilter,
    { provide: INGESTION_CLOCK, useClass: SystemClock },
  ],
})
export class DocumentsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChunkEntity } from '../database/entities/chunk.entity';
import { DocumentEntity } from '../database/entities/document.entity';
import {
  DocumentContent,
  DocumentContentSchema,
} from '../database/schemas/document-content.schema';
import { IngestModule } from '../ingest/ingest.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, ChunkEntity]),
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
    IngestModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}

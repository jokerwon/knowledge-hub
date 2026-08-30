import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChunkEntity } from '../database/entities/chunk.entity';
import { IngestService } from './ingest.service';

// LangChain 边界模块：langchain 相关 import 只允许出现在本目录（ADR-0007，P7-1 强制）。
@Module({
  imports: [TypeOrmModule.forFeature([ChunkEntity])],
  providers: [IngestService],
  exports: [IngestService],
})
export class IngestModule {}

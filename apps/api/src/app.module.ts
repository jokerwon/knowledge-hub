import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './database/data-source';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [TypeOrmModule.forRoot(buildDataSourceOptions()), DocumentsModule],
})
export class AppModule {}

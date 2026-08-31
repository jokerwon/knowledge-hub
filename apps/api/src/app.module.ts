import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, DocumentsModule],
})
export class AppModule {}

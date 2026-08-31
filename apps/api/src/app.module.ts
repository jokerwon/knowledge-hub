import { Module } from '@nestjs/common';
import { AppConfigProviderModule } from './config';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [AppConfigProviderModule, DatabaseModule, DocumentsModule],
})
export class AppModule {}

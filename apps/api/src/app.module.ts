import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [DatabaseModule, DocumentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

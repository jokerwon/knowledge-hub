import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './database/data-source';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  // AuthModule 注册全局 JWT 守卫，documents 等模块默认全部受保护。
  imports: [
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    AuthModule,
    DocumentsModule,
  ],
})
export class AppModule {}

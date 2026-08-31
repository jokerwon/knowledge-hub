import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './data-source';

// 集中承载 PG（TypeORM）与 Mongo（Mongoose）的根连接。
// 各业务模块通过 MongooseModule.forFeature(...) / TypeORM Repository 注入具体模型。
@Module({
  imports: [
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    // 与 buildDataSourceOptions 对 DATABASE_URL 的 fail-fast 保持一致。
    MongooseModule.forRoot(assertMongoUrl()),
  ],
})
export class DatabaseModule {}

function assertMongoUrl(): string {
  const url = process.env.MONGO_URL;
  if (!url) {
    throw new Error('MONGO_URL 未配置，请检查 .env');
  }
  return url;
}

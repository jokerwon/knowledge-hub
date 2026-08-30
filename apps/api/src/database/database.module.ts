import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { buildDataSourceOptions } from './data-source';

// 集中承载 PG（TypeORM）与 Mongo（Mongoose）的根连接。
// 各业务模块通过 MongooseModule.forFeature(...) / TypeORM Repository 注入具体模型。
@Module({
  imports: [
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    MongooseModule.forRoot(process.env.MONGO_URL ?? ''),
  ],
})
export class DatabaseModule {}

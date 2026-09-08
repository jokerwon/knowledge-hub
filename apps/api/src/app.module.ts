import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadAppConfig, type AppConfig } from './config';
import { buildDataSourceOptions } from './database/data-source';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  // AuthModule 注册全局 JWT 守卫，documents 等模块默认全部受保护。
  imports: [
    // isGlobal：ConfigService 全应用可注入。根 .env 的加载在 loadAppConfig 内完成
    // （与 typeorm CLI / vitest 共用同一入口），不走 forRoot 的 dotenv——那会在
    // CWD（apps/api）下找 .env，引入第二个加载位置。
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [loadAppConfig],
    }),
    // env 在 DI 期才解析（forRootAsync），ConfigModule 先于本工厂完成装配。
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) =>
        buildDataSourceOptions(config.getOrThrow('database', { infer: true })),
    }),
    AuthModule,
    DocumentsModule,
  ],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // SIGTERM 时关闭 PG / Mongo 连接，避免停机时在途请求被硬切。
  app.enableShutdownHooks();
  const config = app.get(ConfigService<AppConfig>);
  await app.listen(config.getOrThrow('port', { infer: true }));
}
void bootstrap();

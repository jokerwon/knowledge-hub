import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // SIGTERM 时关闭 PG / Mongo 连接，避免停机时在途请求被硬切。
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8001);
}
void bootstrap();

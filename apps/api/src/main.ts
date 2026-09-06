/**
 * WEMOVE SPORTS API 入口 —— 装配细节见 bootstrap-app.ts（与 e2e 共用）
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './bootstrap-app.js';
import { assertRuntimeConfig } from './config/runtime-config.js';

const PORT = Number(process.env.PORT ?? 8080);

async function bootstrap() {
  assertRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await setupApp(app);
  await app.listen(PORT, '0.0.0.0');
  console.log(`[wemove-api] ready at http://localhost:${PORT}/api/v1`);
}
void bootstrap();

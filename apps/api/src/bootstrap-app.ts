import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/transform.interceptor.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { traceMiddleware } from './common/trace.middleware.js';

/**
 * 应用装配（main.ts 与 e2e 测试共用同一配置，避免测试与生产行为漂移）。
 * 全局约定：前缀 /api/v1 + 统一响应体 {code,message,data,traceId}。
 */
export async function setupApp(app: INestApplication): Promise<void> {
  app.setGlobalPrefix('api/v1');

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.use(traceMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 剥离 DTO 未声明字段（防参数污染）
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
}

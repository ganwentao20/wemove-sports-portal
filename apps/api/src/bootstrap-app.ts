import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { RedisService } from './redis/redis.service.js';
import { TransformInterceptor } from './common/transform.interceptor.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { traceMiddleware } from './common/trace.middleware.js';
import { requestLogMiddleware } from './common/request-log.middleware.js';
import { createGlobalRateLimit } from './common/rate-limit.middleware.js';

/**
 * 应用装配（main.ts 与 e2e 测试共用同一配置，避免测试与生产行为漂移）。
 * 全局约定：前缀 /api/v1 + 统一响应体 {code,message,data,traceId}。
 *
 * 安全/性能加固（组长）：
 * - helmet 安全响应头 + compression(gzip) 响应压缩（首屏性能支撑）
 * - 全局 IP 限流（Redis，健康检查豁免）；请求体上限 256kb；请求访问日志
 */
export async function setupApp(app: INestApplication): Promise<void> {
  app.setGlobalPrefix('api/v1');

  // ---------- 基础中间件（顺序：trace → 限流 → 访问日志） ----------
  app.use(traceMiddleware);
  app.use(createGlobalRateLimit(app.get(RedisService))); // RedisModule 为 @Global
  app.use(requestLogMiddleware);

  // ---------- 安全头 / 压缩 / 请求体上限 ----------
  app.use(
    helmet({
      contentSecurityPolicy: false, // API JSON 场景关闭 CSP（前台 HTML 由 Next 侧管理）
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // 允许媒体资源跨域展示
    }),
  );
  app.use(compression({ threshold: 0 })); // 全量 gzip（API JSON 普遍可压，支撑首屏性能指标）
  (app as NestExpressApplication).useBodyParser('json', { limit: '256kb' });

  // ---------- CORS ----------
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

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

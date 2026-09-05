import type { NextFunction, Request, Response } from 'express';
import { RedisService } from '../redis/redis.service.js';

const DEFAULT_PER_MINUTE = 12000; // 兼容 100 并发压测（100rps×60s=6000）；按需 env 调低防刷

/**
 * 全局 IP 固定窗口限流工厂（组长）：
 * - 键 wm:rl:global:{ip}，窗口 60s；上限 = env GLOBAL_RATE_LIMIT_PER_MIN（默认 12000）
 * - /health 豁免（探活不应被限）
 * - Redis 不可用时自动放行（降级语义与 RedisService 一致，生产必须常驻 Redis）
 */
export function createGlobalRateLimit(redis: RedisService) {
  return async function globalRateLimit(req: Request, res: Response, next: NextFunction) {
    if (req.originalUrl.startsWith('/api/v1/health')) {
      next();
      return;
    }
    const limit = Number(process.env.GLOBAL_RATE_LIMIT_PER_MIN ?? DEFAULT_PER_MINUTE);
    const count = await redis.incrWithTtl(`wm:rl:global:${req.ip ?? 'anon'}`, 60);
    if (count !== null && count > limit) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({
        code: 42900,
        message: 'rate limit exceeded, slow down',
        data: null,
        traceId: req.traceId ?? '',
      });
      return;
    }
    next();
  };
}

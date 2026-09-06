import { describe, expect, it, vi } from 'vitest';
import { HealthController, HealthService } from './health.module.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import type { Response } from 'express';

function serviceWith(dbUp: boolean, redisUp: boolean) {
  const prisma = { ping: vi.fn().mockResolvedValue(dbUp) } as unknown as PrismaService;
  const redis = { ping: vi.fn().mockResolvedValue(redisUp) } as unknown as RedisService;
  return new HealthService(prisma, redis);
}

describe('HealthService readiness', () => {
  it('PostgreSQL 与 Redis 都可用时返回 ready', async () => {
    await expect(serviceWith(true, true).readiness()).resolves.toMatchObject({
      status: 'ready',
      db: 'up',
      redis: 'up',
    });
  });

  it('任一依赖不可用时返回 degraded', async () => {
    await expect(serviceWith(true, false).readiness()).resolves.toMatchObject({
      status: 'degraded',
      db: 'up',
      redis: 'down',
    });
  });
});

describe('HealthController readiness status', () => {
  it('degraded 时设置 HTTP 503', async () => {
    const controller = new HealthController(serviceWith(false, true));
    const status = vi.fn();
    await controller.ready({ status } as unknown as Response);
    expect(status).toHaveBeenCalledWith(503);
  });
});

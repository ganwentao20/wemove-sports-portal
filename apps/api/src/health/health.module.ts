import { Controller, Get, HttpStatus, Injectable, Module, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  liveness() {
    return { status: 'up', at: new Date().toISOString() };
  }

  async readiness() {
    const [dbUp, redisUp] = await Promise.all([this.prisma.ping(), this.redis.ping()]);
    const ready = dbUp && redisUp;
    return {
      status: ready ? 'ready' : 'degraded',
      db: dbUp ? 'up' : 'down',
      redis: redisUp ? 'up' : 'down',
      at: new Date().toISOString(),
    };
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get('live')
  live() {
    return this.service.liveness();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.service.readiness();
    if (result.status !== 'ready') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}

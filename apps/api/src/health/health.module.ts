import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  liveness() {
    return { status: 'up', at: new Date().toISOString() };
  }

  async readiness() {
    const dbUp = await this.prisma.ping();
    return {
      status: dbUp ? 'ready' : 'degraded',
      db: dbUp ? 'up' : 'down',
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
  ready() {
    return this.service.readiness();
  }
}

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}

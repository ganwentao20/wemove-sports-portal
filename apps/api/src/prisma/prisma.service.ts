import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 全局服务（懒连接：首个查询才建连，便于离线单测/健康检查降级）。
 * 迁移/生成命令见 apps/api/package.json 的 prisma:* 脚本。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  /** 供 /health/ready 探活 */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.warn(`db ping failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

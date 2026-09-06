import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DealerController } from './dealer.controller.js';
import { DealerService } from './dealer.service.js';

/**
 * MB：B2B 经销商申请模块；后续 Quick Order/RFQ/PO 在本模块内扩展。
 * OptionalJwtAuthGuard 在本模块 providers 注册（依赖 RedisModule 的 RedisService 与全局 JwtService）。
 */
@Module({
  imports: [RedisModule],
  controllers: [DealerController],
  providers: [DealerService, OptionalJwtAuthGuard],
  exports: [DealerService],
})
export class DealerModule {}

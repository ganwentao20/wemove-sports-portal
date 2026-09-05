import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { DealerController } from './dealer.controller.js';
import { DealerService } from './dealer.service.js';

/** MB：B2B 经销商申请模块；后续 Quick Order/RFQ/PO 在本模块内扩展。 */
@Module({
  imports: [RedisModule],
  controllers: [DealerController],
  providers: [DealerService],
  exports: [DealerService],
})
export class DealerModule {}

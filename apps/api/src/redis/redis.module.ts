import { Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';

/** Redis 模块：RedisService 可注入（未配置/不可达时自动降级，见 service 注释） */
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

import { Module } from '@nestjs/common';
import { FallbackController } from './fallback.controller.js';

/**
 * 404 兜底模块 —— 必须位于 AppModule imports 的【最后一位】：
 * Nest 按模块树注册控制器，兜底通配路由只有最后注册才能避免抢占业务路由。
 */
@Module({
  controllers: [FallbackController],
})
export class FallbackModule {}

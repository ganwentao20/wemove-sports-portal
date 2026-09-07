import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RedisModule } from '../redis/redis.module.js';
@Global()
@Module({
  imports: [PrismaModule, MfaModule, RedisModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

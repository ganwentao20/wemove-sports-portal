import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { RedisModule } from '../redis/redis.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { OrderAdminController } from './order-admin.controller.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';

@Module({
  imports: [AuditModule, AuthModule, RedisModule, MfaModule],
  controllers: [OrderController, OrderAdminController],
  providers: [OrderService, RolesGuard, RequireMfaGuard],
  exports: [OrderService],
})
export class OrderModule {}

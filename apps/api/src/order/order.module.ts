import { MediaModule } from '../media/media.module.js';
import { ReturnEvidenceService } from './return-evidence.service.js';
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
import { CommerceService } from './commerce.service.js';
import { InventoryModule } from './inventory.module.js';
import { TaxShippingService } from './tax-shipping.service.js';
import { CustomerOnlyGuard } from './customer-only.guard.js';
import {
  CommercePublicController,
  CommerceCustomerController,
  CommerceAdminController,
} from './commerce.controller.js';

@Module({
  imports: [
    MediaModule,
    AuditModule,
    AuthModule,
    RedisModule,
    MfaModule,
    InventoryModule,
  ],
  controllers: [
    OrderController,
    OrderAdminController,
    CommercePublicController,
    CommerceCustomerController,
    CommerceAdminController,
  ],
  providers: [
    OrderService,
    CommerceService,
    ReturnEvidenceService,
    TaxShippingService,
    CustomerOnlyGuard,
    RolesGuard,
    RequireMfaGuard,
  ],
  exports: [OrderService],
})
export class OrderModule {}

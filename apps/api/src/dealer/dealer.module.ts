import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { MediaModule } from '../media/media.module.js';
import { DealerController } from './dealer.controller.js';
import { DealerAdminController } from './dealer-admin.controller.js';
import { DealerService } from './dealer.service.js';

/**
 * MB：B2B 经销商申请模块；后续 Quick Order/RFQ/PO 在本模块内扩展。
 * OptionalJwtAuthGuard 在本模块 providers 注册（依赖 RedisModule 的 RedisService 与全局 JwtService）。
 */
@Module({
  imports: [RedisModule, AuditModule, PricingModule, MfaModule, MediaModule],
  controllers: [DealerController, DealerAdminController],
  providers: [DealerService, OptionalJwtAuthGuard, RolesGuard, RequireMfaGuard],
  exports: [DealerService],
})
export class DealerModule {}

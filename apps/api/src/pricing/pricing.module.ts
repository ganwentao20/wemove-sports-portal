import { Injectable, Module } from '@nestjs/common';
import {
  isAllowedDealerPriceView,
  resolveDealerPrice,
  resolveRetailPrice,
  type PriceContext,
  type PricingRuleCandidate,
  type ResolvedPrice,
  type ViewerContext,
} from './pricing-engine.js';
import { PricingAdminController } from './pricing-admin.controller.js';
import { PricingAdminService } from './pricing-admin.service.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { MfaModule } from '../mfa/mfa.module.js';

/** 引擎门面：供后续订单模块注入（组员 C 的 admin service 直接用 pricing-engine 纯函数，避免反向循环依赖） */
@Injectable()
export class PricingEngine {
  dealer(rules: PricingRuleCandidate[], ctx: PriceContext): ResolvedPrice | null {
    return resolveDealerPrice(rules, ctx);
  }

  retail(variant: { msrpCents?: number | null; salePriceCents?: number | null }): ResolvedPrice | null {
    return resolveRetailPrice(variant);
  }

  canViewDealerPrice(viewer: ViewerContext): boolean {
    return isAllowedDealerPriceView(viewer);
  }
}

@Module({
  imports: [AuditModule, AuthModule, RedisModule, MfaModule],
  controllers: [PricingAdminController],
  providers: [PricingEngine, PricingAdminService, RolesGuard, RequireMfaGuard],
  exports: [PricingEngine, PricingAdminService],
})
export class PricingModule {}

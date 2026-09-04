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

/** 引擎门面：供 Service 层注入（后续由组员 C 实现 DB 候选规则装配，见 schema PricingRule） */
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
  providers: [PricingEngine],
  exports: [PricingEngine],
})
export class PricingModule {}

import { describe, expect, it } from 'vitest';
import {
  isAllowedDealerPriceView,
  resolveDealerPrice,
  resolveRetailPrice,
  type PriceContext,
  type PricingRuleCandidate,
} from './pricing-engine.js';

const companyId = 'company-1';
const goldTierId = 'tier-gold';

function rule(partial: Partial<PricingRuleCandidate> & { id: string; scope: PricingRuleCandidate['scope'] }): PricingRuleCandidate {
  return { priority: 0, priceCents: 0, minQty: 1, ...partial } as PricingRuleCandidate;
}

const ctx: PriceContext = {
  companyId,
  tierId: goldTierId,
  authorizedBookIds: ['book-a'],
  quantity: 10,
};

describe('pricing-engine · 优先级链', () => {
  it('企业专属价 > 价格表 > 等级价 > B2B 默认价', () => {
    const rules: PricingRuleCandidate[] = [
      rule({ id: 'b2b', scope: 'B2B_DEFAULT', priceCents: 3000 }),
      rule({ id: 'tier', scope: 'TIER_LEVEL', tierId: goldTierId, priceCents: 2500 }),
      rule({ id: 'book', scope: 'PRICE_TABLE', bookId: 'book-a', priceCents: 2200 }),
      rule({ id: 'company', scope: 'COMPANY_SPECIFIC', companyId, priceCents: 2000 }),
    ];
    const result = resolveDealerPrice(rules, ctx);
    expect(result).toEqual({ priceCents: 2000, source: 'COMPANY_SPECIFIC', ruleId: 'company' });
  });

  it('企业专属价未命中（别家公司的规则）时回退价格表', () => {
    const rules: PricingRuleCandidate[] = [
      rule({ id: 'b2b', scope: 'B2B_DEFAULT', priceCents: 3000 }),
      rule({ id: 'other', scope: 'COMPANY_SPECIFIC', companyId: 'company-other', priceCents: 1 }),
      rule({ id: 'book', scope: 'PRICE_TABLE', bookId: 'book-a', priceCents: 2200 }),
    ];
    const result = resolveDealerPrice(rules, ctx);
    expect(result?.source).toBe('PRICE_TABLE');
    expect(result?.priceCents).toBe(2200);
  });

  it('未授权价格表不可见（bookId 不在授权清单 → 跳过，继续链）', () => {
    const rules: PricingRuleCandidate[] = [
      rule({ id: 'b2b', scope: 'B2B_DEFAULT', priceCents: 3000 }),
      rule({ id: 'book-x', scope: 'PRICE_TABLE', bookId: 'book-x', priceCents: 100 }),
      rule({ id: 'tier', scope: 'TIER_LEVEL', tierId: goldTierId, priceCents: 2500 }),
    ];
    const result = resolveDealerPrice(rules, ctx);
    expect(result?.source).toBe('TIER_LEVEL');
    expect(result?.priceCents).toBe(2500);
  });

  it('全部未命中返回 null（服务层决定报错或兜底）', () => {
    expect(resolveDealerPrice([], ctx)).toBeNull();
    const onlyOtherCompany = [rule({ id: 'x', scope: 'COMPANY_SPECIFIC', companyId: 'other', priceCents: 1 })];
    expect(resolveDealerPrice(onlyOtherCompany, ctx)).toBeNull();
  });
});

describe('pricing-engine · 阶梯档（minQty）', () => {
  it('数量满足时取最高档（更低价）', () => {
    const rules: PricingRuleCandidate[] = [
      rule({ id: 'q1', scope: 'TIER_LEVEL', tierId: goldTierId, priceCents: 2500, minQty: 1 }),
      rule({ id: 'q5', scope: 'TIER_LEVEL', tierId: goldTierId, priceCents: 2200, minQty: 5 }),
      rule({ id: 'q20', scope: 'TIER_LEVEL', tierId: goldTierId, priceCents: 1900, minQty: 20 }),
      rule({ id: 'b2b', scope: 'B2B_DEFAULT', priceCents: 3000 }),
    ];
    expect(resolveDealerPrice(rules, { ...ctx, quantity: 10 })?.priceCents).toBe(2200);
    expect(resolveDealerPrice(rules, { ...ctx, quantity: 25 })?.priceCents).toBe(1900);
  });

  it('高档位未达起订量时该档整档跳过（允许低优先级 scope 命中）', () => {
    const rules: PricingRuleCandidate[] = [
      rule({ id: 'company50', scope: 'COMPANY_SPECIFIC', companyId, priceCents: 1000, minQty: 50 }),
      rule({ id: 'book', scope: 'PRICE_TABLE', bookId: 'book-a', priceCents: 1500, minQty: 1 }),
      rule({ id: 'b2b', scope: 'B2B_DEFAULT', priceCents: 2000 }),
    ];
    const result = resolveDealerPrice(rules, { ...ctx, quantity: 10 });
    expect(result?.source).toBe('PRICE_TABLE');
    expect(result?.priceCents).toBe(1500);
  });
});

describe('pricing-engine · 零售价与越权边界', () => {
  it('Sale 优先于 MSRP', () => {
    expect(resolveRetailPrice({ msrpCents: 3999, salePriceCents: 2999 })).toEqual({
      priceCents: 2999,
      source: 'SALE',
    });
  });

  it('无售价时回退 MSRP，两者皆空为 null', () => {
    expect(resolveRetailPrice({ msrpCents: 3999, salePriceCents: null })?.source).toBe('MSRP');
    expect(resolveRetailPrice({ msrpCents: null, salePriceCents: null })).toBeNull();
  });

  it('游客与普通零售用户不可查看 dealer 价', () => {
    expect(isAllowedDealerPriceView({ kind: undefined })).toBe(false);
    expect(isAllowedDealerPriceView({ kind: 'customer', companyId: null })).toBe(false);
  });

  it('经销商成员（有企业）与员工可查看', () => {
    expect(isAllowedDealerPriceView({ kind: 'customer', companyId })).toBe(true);
    expect(isAllowedDealerPriceView({ kind: 'staff' })).toBe(true);
  });
});

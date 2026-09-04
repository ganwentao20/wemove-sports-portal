/**
 * 多层级价格引擎（核心算法 · 纯函数，禁止副作用 —— 组员 C 主责 + 组长联调）
 *
 * 取价优先级链（规格硬约束）：
 *   企业专属价 COMPANY_SPECIFIC(0) > 价格表 PRICE_TABLE(1) > 经销商等级价 TIER_LEVEL(2) > 默认 B2B 价 B2B_DEFAULT(3)
 *   零售用户只取 MSRP/Sale，永远不经过 dealer 链（服务层防越权，见 catalog 注释）。
 * 阶梯：同一 scope 内多条 minQty 档，取“满足数量且档位最大”的一条。
 */

export type PricingScopeCode = 'COMPANY_SPECIFIC' | 'PRICE_TABLE' | 'TIER_LEVEL' | 'B2B_DEFAULT';

export interface PricingRuleCandidate {
  id: string;
  scope: PricingScopeCode;
  priority: number; // 同 scope 内越大越优先
  companyId?: string | null;
  bookId?: string | null;
  tierId?: string | null;
  priceCents: number;
  minQty: number;
}

export interface PriceContext {
  companyId: string; // 企业边界：公司级隔离由调用方保证（服务层必须传当前登录者所属企业）
  tierId?: string | null;
  authorizedBookIds?: string[]; // 企业被授权的价格表
  quantity?: number;
}

export type DealerPriceSource = PricingScopeCode;
export type RetailPriceSource = 'MSRP' | 'SALE';

export interface ResolvedPrice {
  priceCents: number;
  source: DealerPriceSource | RetailPriceSource;
  ruleId?: string;
}

const SCOPE_RANK: Record<PricingScopeCode, number> = {
  COMPANY_SPECIFIC: 0,
  PRICE_TABLE: 1,
  TIER_LEVEL: 2,
  B2B_DEFAULT: 3,
};

/** 企业专属价以外的规则是否与当前企业上下文匹配 */
function matchesScope(rule: PricingRuleCandidate, ctx: PriceContext): boolean {
  switch (rule.scope) {
    case 'COMPANY_SPECIFIC':
      return rule.companyId === ctx.companyId;
    case 'PRICE_TABLE':
      return rule.bookId != null && (ctx.authorizedBookIds ?? []).includes(rule.bookId);
    case 'TIER_LEVEL':
      return ctx.tierId != null && rule.tierId === ctx.tierId;
    case 'B2B_DEFAULT':
      return true;
  }
}

/** 同 scope 阶梯档择优：取 minQty ≤ 数量 的最大档；同档取 priority 大者 */
function bestOfScope(
  rules: PricingRuleCandidate[],
  quantity: number,
): PricingRuleCandidate | null {
  let best: PricingRuleCandidate | null = null;
  for (const rule of rules) {
    if (rule.minQty > quantity) continue; // 未达到起订档，该档不可用
    if (!best) {
      best = rule;
      continue;
    }
    const betterQty = rule.minQty > best.minQty;
    const sameQty = rule.minQty === best.minQty;
    if (betterQty || (sameQty && rule.priority > best.priority)) {
      best = rule;
    }
  }
  return best;
}

/**
 * 经销商取价：按 scope 优先级链返回命中规则。
 * 返回值 null 表示无可用规则（调用方按策略回退 B2B_DEFAULT 变体列或报错）。
 */
export function resolveDealerPrice(
  rules: PricingRuleCandidate[],
  ctx: PriceContext,
): ResolvedPrice | null {
  const quantity = Math.max(1, ctx.quantity ?? 1);
  const groups = new Map<PricingScopeCode, PricingRuleCandidate[]>();
  for (const rule of rules) {
    if (!matchesScope(rule, ctx)) continue;
    const list = groups.get(rule.scope) ?? [];
    list.push(rule);
    groups.set(rule.scope, list);
  }

  let best: { rank: number; rule: PricingRuleCandidate } | null = null;
  for (const [scope, list] of groups) {
    const rule = bestOfScope(list, quantity);
    if (!rule) continue;
    const rank = SCOPE_RANK[scope];
    if (!best || rank < best.rank) {
      best = { rank, rule };
    }
  }

  return best
    ? { priceCents: best.rule.priceCents, source: best.rule.scope, ruleId: best.rule.id }
    : null;
}

/** 零售取价：Sale 优先于 MSRP（两者皆空 → null） */
export function resolveRetailPrice(variant: {
  msrpCents?: number | null;
  salePriceCents?: number | null;
}): ResolvedPrice | null {
  if (variant.salePriceCents != null) {
    return { priceCents: variant.salePriceCents, source: 'SALE' };
  }
  if (variant.msrpCents != null) {
    return { priceCents: variant.msrpCents, source: 'MSRP' };
  }
  return null;
}

export interface ViewerContext {
  kind?: string; // customer | staff | 游客（无）
  companyId?: string | null;
}

/**
 * 越权边界判定（安全测试点，组员 E 依据此逻辑做水平/垂直越权用例）：
 * - 游客/零售用户（无公司）→ 不可看 dealer 价
 * - 员工（staff）→ 可看（后台需要）
 * - 经销商成员 → 仅当挂靠已审核企业（companyId 非空）
 */
export function isAllowedDealerPriceView(viewer: ViewerContext): boolean {
  if (viewer.kind === 'staff') return true;
  if (viewer.kind !== 'customer') return false;
  return typeof viewer.companyId === 'string' && viewer.companyId.length > 0;
}

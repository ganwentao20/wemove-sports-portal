import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { toPaged } from '../common/pagination.dto.js';
import type { Paged } from '../common/api-response.js';
import { resolveDealerPrice } from './pricing-engine.js';
import type { PriceContext, PricingRuleCandidate, ResolvedPrice } from './pricing-engine.js';
import type {
  CreatePricingRuleDto,
  PricingRuleQueryDto,
  ResolvePriceQueryDto,
  UpdatePricingRuleDto,
} from './dto/pricing.dto.js';
import type { JwtPayload } from '../auth/auth.service.js';

@Injectable()
export class PricingAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PricingRuleQueryDto): Promise<Paged<unknown>> {
    const where = {
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.bookId ? { bookId: query.bookId } : {}),
      ...(query.tierId ? { tierId: query.tierId } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.pricingRule.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { minQty: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.pricingRule.count({ where }),
    ]);

    return toPaged(rows, total, query);
  }

  async detail(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new BizException(ERROR_CODES.NOT_FOUND, 'pricing rule not found', 404);
    return rule;
  }

  async create(dto: CreatePricingRuleDto, actor: JwtPayload) {
    await this.validateScopeRefs(dto);

    const rule = await this.prisma.pricingRule.create({
      data: {
        variantId: dto.variantId,
        scope: dto.scope,
        priority: dto.priority ?? 0,
        companyId: dto.companyId ?? null,
        bookId: dto.bookId ?? null,
        tierId: dto.tierId ?? null,
        priceCents: dto.priceCents,
        minQty: dto.minQty ?? 1,
        active: dto.active ?? true,
        note: dto.note ?? null,
      },
    });

    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'pricing.rule.create',
      entityType: 'pricingRule',
      entityId: rule.id,
      after: { ...dto, id: rule.id },
    });

    return rule;
  }

  async update(id: string, dto: UpdatePricingRuleDto, actor: JwtPayload) {
    const before = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!before) throw new BizException(ERROR_CODES.NOT_FOUND, 'pricing rule not found', 404);

    const effectiveScope = dto.scope ?? (before.scope as CreatePricingRuleDto['scope']);
    await this.validateScopeRefs({
      scope: effectiveScope,
      companyId: dto.companyId,
      bookId: dto.bookId,
      tierId: dto.tierId,
    } as Partial<CreatePricingRuleDto>);

    const rule = await this.prisma.pricingRule.update({
      where: { id },
      data: {
        ...(dto.scope ? { scope: dto.scope } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.bookId !== undefined ? { bookId: dto.bookId } : {}),
        ...(dto.tierId !== undefined ? { tierId: dto.tierId } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.minQty !== undefined ? { minQty: dto.minQty } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });

    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'pricing.rule.update',
      entityType: 'pricingRule',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: rule as unknown as Record<string, unknown>,
    });

    return rule;
  }

  async remove(id: string, actor: JwtPayload) {
    const before = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!before) throw new BizException(ERROR_CODES.NOT_FOUND, 'pricing rule not found', 404);

    await this.prisma.pricingRule.delete({ where: { id } });

    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'pricing.rule.delete',
      entityType: 'pricingRule',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
    });

    return { id, deleted: true as const };
  }

  async resolveDealerPriceFor(
    variantId: string,
    ctx: ResolvePriceQueryDto,
  ): Promise<{ variantId: string; input: ResolvePriceQueryDto; resolved: ResolvedPrice | null }> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, b2bDefaultPriceCents: true },
    });
    if (!variant) throw new BizException(ERROR_CODES.NOT_FOUND, 'variant not found', 404);

    const rules = await this.prisma.pricingRule.findMany({
      where: { variantId, active: true },
      select: {
        id: true,
        scope: true,
        priority: true,
        companyId: true,
        bookId: true,
        tierId: true,
        priceCents: true,
        minQty: true,
      },
    });

    const candidates: PricingRuleCandidate[] = rules.map((r) => ({
      id: r.id,
      scope: r.scope as PricingRuleCandidate['scope'],
      priority: r.priority,
      companyId: r.companyId,
      bookId: r.bookId,
      tierId: r.tierId,
      priceCents: r.priceCents,
      minQty: r.minQty,
    }));

    const hasB2bDefault = candidates.some((r) => r.scope === 'B2B_DEFAULT');
    if (!hasB2bDefault && variant.b2bDefaultPriceCents != null) {
      candidates.push({
        id: 'variant-b2b-default',
        scope: 'B2B_DEFAULT',
        priority: 0,
        companyId: null,
        bookId: null,
        tierId: null,
        priceCents: variant.b2bDefaultPriceCents,
        minQty: 1,
      });
    }

    const priceContext: PriceContext = {
      companyId: ctx.companyId,
      tierId: ctx.tierId ?? null,
      authorizedBookIds: ctx.bookId ? [ctx.bookId] : [],
      quantity: ctx.quantity,
    };

    return { variantId, input: ctx, resolved: resolveDealerPrice(candidates, priceContext) };
  }

  private async validateScopeRefs(dto: Partial<CreatePricingRuleDto>): Promise<void> {
    const scope = dto.scope;
    if (!scope) return;

    if (scope === 'COMPANY_SPECIFIC' && dto.companyId) {
      const exists = await this.prisma.dealerCompany.findUnique({ where: { id: dto.companyId } });
      if (!exists) throw new BizException(ERROR_CODES.VALIDATION, 'companyId not found', 422);
    }
    if (scope === 'PRICE_TABLE' && dto.bookId) {
      const exists = await this.prisma.priceBook.findUnique({ where: { id: dto.bookId } });
      if (!exists) throw new BizException(ERROR_CODES.VALIDATION, 'bookId not found', 422);
    }
    if (scope === 'TIER_LEVEL' && dto.tierId) {
      const exists = await this.prisma.dealerTier.findUnique({ where: { id: dto.tierId } });
      if (!exists) throw new BizException(ERROR_CODES.VALIDATION, 'tierId not found', 422);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { toPaged } from '../common/pagination.dto.js';
import type { Paged } from '../common/api-response.js';
import { resolveDealerPrice } from './pricing-engine.js';
import type {
  PriceContext,
  PricingRuleCandidate,
  ResolvedPrice,
} from './pricing-engine.js';
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
    if (!rule)
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'pricing rule not found',
        404,
      );
    return rule;
  }

  async create(dto: CreatePricingRuleDto, actor: JwtPayload) {
    await this.ensureVariantExists(dto.variantId);
    const refs = await this.normalizeScopeRefs(dto.scope, dto);

    const rule = await this.prisma.pricingRule.create({
      data: {
        variantId: dto.variantId,
        scope: dto.scope,
        priority: dto.priority ?? 0,
        ...refs,
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
    if (!before)
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'pricing rule not found',
        404,
      );

    const effectiveScope =
      dto.scope ?? (before.scope as CreatePricingRuleDto['scope']);
    const scopeChanged = effectiveScope !== before.scope;
    const refs = await this.normalizeScopeRefs(
      effectiveScope,
      dto,
      scopeChanged ? undefined : before,
    );

    const rule = await this.prisma.pricingRule.update({
      where: { id },
      data: {
        ...(dto.scope ? { scope: dto.scope } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...refs,
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
    if (!before)
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'pricing rule not found',
        404,
      );

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
  ): Promise<{
    variantId: string;
    input: ResolvePriceQueryDto;
    resolved: ResolvedPrice | null;
  }> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, b2bDefaultPriceCents: true },
    });
    if (!variant)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'variant not found', 404);

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

    return {
      variantId,
      input: ctx,
      resolved: resolveDealerPrice(candidates, priceContext),
    };
  }

  private async ensureVariantExists(variantId: string): Promise<void> {
    const exists = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });
    if (!exists)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'variantId not found',
        422,
      );
  }

  private async normalizeScopeRefs(
    scope: CreatePricingRuleDto['scope'],
    supplied: Pick<UpdatePricingRuleDto, 'companyId' | 'bookId' | 'tierId'>,
    existing?: {
      companyId: string | null;
      bookId: string | null;
      tierId: string | null;
    },
  ): Promise<{
    companyId: string | null;
    bookId: string | null;
    tierId: string | null;
  }> {
    const companyId = supplied.companyId ?? existing?.companyId ?? null;
    const bookId = supplied.bookId ?? existing?.bookId ?? null;
    const tierId = supplied.tierId ?? existing?.tierId ?? null;

    if (scope === 'COMPANY_SPECIFIC') {
      if (supplied.bookId !== undefined || supplied.tierId !== undefined) {
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'bookId/tierId are not allowed for COMPANY_SPECIFIC',
          422,
        );
      }
      if (!companyId)
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'companyId is required',
          422,
        );
      const exists = await this.prisma.dealerCompany.findUnique({
        where: { id: companyId },
      });
      if (!exists)
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'companyId not found',
          422,
        );
      return { companyId, bookId: null, tierId: null };
    }

    if (scope === 'PRICE_TABLE') {
      if (supplied.companyId !== undefined || supplied.tierId !== undefined) {
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'companyId/tierId are not allowed for PRICE_TABLE',
          422,
        );
      }
      if (!bookId)
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'bookId is required',
          422,
        );
      const exists = await this.prisma.priceBook.findUnique({
        where: { id: bookId },
      });
      if (!exists)
        throw new BizException(ERROR_CODES.VALIDATION, 'bookId not found', 422);
      return { companyId: null, bookId, tierId: null };
    }

    if (scope === 'TIER_LEVEL') {
      if (supplied.companyId !== undefined || supplied.bookId !== undefined) {
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'companyId/bookId are not allowed for TIER_LEVEL',
          422,
        );
      }
      if (!tierId)
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'tierId is required',
          422,
        );
      const exists = await this.prisma.dealerTier.findUnique({
        where: { id: tierId },
      });
      if (!exists)
        throw new BizException(ERROR_CODES.VALIDATION, 'tierId not found', 422);
      return { companyId: null, bookId: null, tierId };
    }

    if (
      supplied.companyId !== undefined ||
      supplied.bookId !== undefined ||
      supplied.tierId !== undefined
    ) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'scope references are not allowed for B2B_DEFAULT',
        422,
      );
    }
    return { companyId: null, bookId: null, tierId: null };
  }
}

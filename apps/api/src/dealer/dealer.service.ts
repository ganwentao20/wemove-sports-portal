import { publicDirectoryRow } from './directory-policy.js';
import { Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { NotificationsService } from '../notifications/notifications.service.js';
import { inventoryAvailability } from '../order/inventory.service.js';
import {
  catalogWhere,
  catalogVariantWhere,
  purchaseRule,
} from './catalog-policy.js';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PricingEngine } from '../pricing/pricing.module.js';
import type { PricingRuleCandidate } from '../pricing/pricing-engine.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';
import type { QuickOrderLineDto } from './dto/quick-order.dto.js';
import type {
  ReviewDealerApplicationDto,
  ReviewStatus,
} from './dto/review-dealer-application.dto.js';

const APPLICATION_RATE_LIMIT = { max: 5, windowSec: 60 } as const;
const ATTACHMENT_RATE_LIMIT = { max: 10, windowSec: 3600 } as const;

interface ApprovalApplication {
  id: string;
  companyId: string | null;
  applicantId: string | null;
  companyName: string;
  legalRegNo: string;
  country: string;
}

/**
 * MB：经销商申请服务。
 * 归属边界（安全红线）：applicantId（登录提交时绑定的外键）或 companyId（已关联企业）；
 * 严禁用 contactEmail 字符串判定归属 —— 未验证邮箱可被伪造，会造成水平越权读取他人申请。
 */
@Injectable()
export class DealerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly pricing: PricingEngine,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async assertAttachmentUploadAllowed(ip?: string) {
    const count = await this.redis.incrWithTtl(
      `wm:rl:dealer-attachment:ip:${ip ?? 'anon'}`,
      ATTACHMENT_RATE_LIMIT.windowSec,
    );
    if (count !== null && count > ATTACHMENT_RATE_LIMIT.max) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many qualification uploads, try later',
        429,
      );
    }
  }

  async directory(id?: string) {
    const companies = await this.prisma.dealerCompany.findMany({
      where: {
        status: 'APPROVED',
        profile: {
          path: ['directoryPublished', 'publicListing'],
          equals: true,
        },
        ...(id ? { id } : {}),
      },
      select: {
        id: true,
        companyName: true,
        country: true,
        profile: true,
        catalogPolicy: true,
      },
      orderBy: { companyName: 'asc' },
    });
    const rows = (
      await Promise.all(
        companies.map(async (company) => {
          const categories = await this.prisma.productCategory.findMany({
            where: {
              active: true,
              products: {
                some: {
                  AND: [
                    catalogWhere(company.catalogPolicy, company.country),
                    {
                      variants: {
                        some: {
                          status: true,
                          ...catalogVariantWhere(company.catalogPolicy),
                        },
                      },
                    },
                  ],
                },
              },
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          });
          return publicDirectoryRow(company, categories);
        }),
      )
    ).filter((row) => row !== null);
    if (id) {
      const detail = rows.find((row) => row.detailPath);
      if (!detail)
        throw new BizException(
          ERROR_CODES.NOT_FOUND,
          'Public dealer detail not found',
          404,
        );
      return detail;
    }
    return rows;
  }
  async assertQualificationBelongs(applicationId: string, mediaId: string) {
    const application = await this.prisma.dealerApplication.findUnique({
      where: { id: applicationId },
      select: { attachments: true },
    });
    if (
      !application ||
      !Array.isArray(application.attachments) ||
      !application.attachments.some(
        (a) =>
          a &&
          typeof a === 'object' &&
          !Array.isArray(a) &&
          a.mediaId === mediaId,
      )
    )
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'application attachment not found',
        404,
      );
  }

  /**
   * 提交申请（公开可提交；携带登录态（customer）时绑定 applicantId 便于本人跟进）。
   * @param applicant 可选登录用户（仅 customer 会绑定；staff 不绑定）
   */
  async createApplication(
    dto: CreateDealerApplicationDto,
    ip?: string,
    applicant?: JwtPayload | null,
  ) {
    const count = await this.redis.incrWithTtl(
      `wm:rl:dealer-application:ip:${ip ?? 'anon'}`,
      APPLICATION_RATE_LIMIT.windowSec,
    );
    if (dto.agreementsAccepted !== true)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'privacy policy and dealer declaration agreement is required',
        422,
      );
    if (count !== null && count > APPLICATION_RATE_LIMIT.max) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many dealer applications, slow down',
        429,
      );
    }

    const contactEmail = dto.contactEmail.trim().toLowerCase();
    const claimToken =
      applicant?.kind === 'customer' ? null : randomBytes(32).toString('hex');

    // 同一联系邮箱已有在途申请 → 409（防重复刷单）
    const duplicateByEmail = await this.prisma.dealerApplication.findFirst({
      where: {
        OR: [
          { contactEmail },
          { legalRegNo: dto.legalRegNo.trim(), country: dto.country.trim() },
        ],
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'] },
      },
      select: { id: true },
    });
    if (duplicateByEmail) {
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'dealer application already pending',
        409,
      );
    }

    // 登录用户本人已有在途申请 → 409
    if (applicant?.kind === 'customer') {
      const duplicateByApplicant =
        await this.prisma.dealerApplication.findFirst({
          where: {
            applicantId: applicant.sub,
            status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'] },
          },
          select: { id: true },
        });
      if (duplicateByApplicant) {
        throw new BizException(
          ERROR_CODES.CONFLICT,
          'you already have a pending dealer application',
          409,
        );
      }
    }

    const mediaIds = [...new Set(dto.attachments.map((item) => item.mediaId))];
    const storedMedia = mediaIds.length
      ? await this.prisma.mediaAsset.findMany({
          where: {
            id: { in: mediaIds },
            visibility: 'DEALER_ONLY',
            qualification: true,
            scanStatus: {
              in:
                process.env.MEDIA_SCAN_REQUIRED === 'true'
                  ? ['CLEAN']
                  : ['CLEAN', 'SIGNATURE_CHECKED', 'LEGACY_UNSCANNED'],
            },
          },
          select: {
            id: true,
            key: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
          },
        })
      : [];
    const storedById = new Map(storedMedia.map((item) => [item.id, item]));
    if (
      storedMedia.length !== mediaIds.length ||
      dto.attachments.some((item) => {
        const stored = storedById.get(item.mediaId);
        return (
          !stored ||
          stored.fileName !== item.fileName ||
          stored.key !== item.attachmentToken ||
          stored.mimeType !== item.mimeType ||
          stored.sizeBytes !== item.sizeBytes
        );
      })
    ) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'qualification attachment is invalid',
        422,
      );
    }

    const attachments: Prisma.InputJsonValue = dto.attachments.map((item) => ({
      mediaId: item.mediaId,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      visibility: 'PRIVATE',
    }));

    const application = await this.prisma.dealerApplication.create({
      data: {
        companyName: dto.companyName.trim(),
        legalRegNo: dto.legalRegNo.trim(),
        contactName: dto.contactName.trim(),
        contactEmail,
        phone: dto.phone.trim(),
        country: dto.country.trim(),
        businessType: dto.businessType.trim(),
        attachments,
        applicantId: applicant?.kind === 'customer' ? applicant.sub : null,
        agreementVersion: dto.agreementVersion ?? 'dealer-2026-09',
        agreedAt: new Date(),
        consentIp: ip,
        claimTokenHash: claimToken
          ? createHash('sha256').update(claimToken).digest('hex')
          : null,
        claimExpiresAt: claimToken ? new Date(Date.now() + 7 * 86400000) : null,
      },
      select: this.applicationSelect(),
    });
    await this.notifications?.enqueue({
      kind: 'dealer.application.confirmation',
      to: contactEmail,
      subject: 'Dealer application received',
      text: `Application ${application.id} received. ${claimToken ? `Register and verify this email, then claim your application: ${process.env.APP_BASE_URL ?? process.env.WEB_URL ?? 'http://localhost:3000'}/dealer/application?application=${application.id}#claim=${claimToken}` : `Track your application: ${process.env.APP_BASE_URL ?? process.env.WEB_URL ?? 'http://localhost:3000'}/dealer/application?application=${application.id}`}`,
      dedupeKey: `application:${application.id}:received`,
    });
    return application;
  }

  /** 查询申请：仅本人（applicantId）或已关联企业成员（companyId，企业须 APPROVED 由 token 保证）可读 */
  async findApplication(id: string, currentUser: JwtPayload) {
    if (currentUser.kind !== 'customer') {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'dealer application is customer-only',
        403,
      );
    }

    const application = await this.prisma.dealerApplication.findUnique({
      where: { id },
      select: this.applicationSelect(),
    });
    if (!application) {
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'dealer application not found',
        404,
      );
    }

    const isApplicant = application.applicantId === currentUser.sub;
    const isCompanyMember =
      currentUser.companyId != null &&
      application.companyId === currentUser.companyId;

    if (!isApplicant && !isCompanyMember) {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'dealer application belongs to another account',
        403,
      );
    }
    return application;
  }

  /** 审核工作台列表：课程核心版按状态筛选，最新申请优先。 */
  listApplications(status?: 'SUBMITTED' | ReviewStatus) {
    return this.prisma.dealerApplication.findMany({
      where: status ? { status } : undefined,
      select: this.applicationSelect(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** 严格状态机：终态不可回退；补件后可重新进入审核。 */
  async reviewApplication(
    id: string,
    dto: ReviewDealerApplicationDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    if (actor.kind !== 'staff') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'staff only', 403);
    }
    const application = await this.prisma.dealerApplication.findUnique({
      where: { id },
      select: this.applicationSelect(),
    });
    if (!application) {
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'dealer application not found',
        404,
      );
    }

    const allowed: Record<string, ReviewStatus[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'APPROVED', 'REJECTED'],
      UNDER_REVIEW: ['MORE_INFO_REQUIRED', 'APPROVED', 'REJECTED'],
      MORE_INFO_REQUIRED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      APPROVED: [],
      REJECTED: [],
    };
    if (!allowed[application.status]?.includes(dto.status)) {
      throw new BizException(
        ERROR_CODES.CONFLICT,
        `invalid application transition: ${application.status} -> ${dto.status}`,
        409,
      );
    }
    if (
      (dto.status === 'MORE_INFO_REQUIRED' || dto.status === 'REJECTED') &&
      !dto.remark?.trim()
    ) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'remark is required for this review result',
        400,
      );
    }

    const reviewedAt = new Date();
    const reviewData = {
      status: dto.status,
      remark: dto.remark?.trim() || null,
      reviewedBy: actor.sub,
      reviewedAt,
    } as const;

    const reviewed =
      dto.status === 'APPROVED'
        ? await this.approveApplication(application, reviewData)
        : await this.prisma.dealerApplication.update({
            where: { id },
            data: reviewData,
            select: this.applicationSelect(),
          });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'dealer.application.review',
      entityType: 'dealerApplication',
      entityId: id,
      before: { status: application.status, remark: application.remark },
      after: { status: reviewed.status, remark: reviewed.remark },
      ip,
    });
    await this.notifications?.enqueue({
      kind: 'dealer.application.review',
      to: application.contactEmail,
      subject: `Dealer application ${reviewed.status}`,
      text: `Application ${id}: ${reviewed.status}. ${reviewed.remark ?? ''} ${reviewed.status === 'APPROVED' ? 'Your company is active. Sign in at /dealer/login.' : `Review and resubmit at /dealer/application?application=${id}`}`,
      dedupeKey: `application:${id}:${reviewedAt.toISOString()}`,
    });
    return reviewed;
  }

  /** 审核通过必须原子化创建/批准企业、绑定申请人 OWNER，并回填 companyId。 */
  private async approveApplication(
    application: ApprovalApplication,
    reviewData: {
      status: ReviewStatus;
      remark: string | null;
      reviewedBy: string;
      reviewedAt: Date;
    },
  ) {
    if (!application.companyId && !application.applicantId) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'bind the application to a customer account before approval',
        400,
      );
    }
    if (!application.companyName.trim() || !application.legalRegNo.trim()) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'company name and legal registration number are required before approval',
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let companyId = application.companyId;
      if (companyId) {
        await tx.dealerCompany.update({
          where: { id: companyId },
          data: { status: 'APPROVED', approvedAt: reviewData.reviewedAt },
        });
      } else {
        const company = await tx.dealerCompany.create({
          data: {
            companyName: application.companyName.trim(),
            legalRegNo: application.legalRegNo.trim(),
            country: application.country.trim(),
            status: 'APPROVED',
            approvedAt: reviewData.reviewedAt,
          },
          select: { id: true },
        });
        companyId = company.id;
      }

      if (application.applicantId) {
        await tx.dealerMember.upsert({
          where: {
            companyId_userId: {
              companyId,
              userId: application.applicantId,
            },
          },
          create: {
            companyId,
            userId: application.applicantId,
            role: 'OWNER',
          },
          update: { role: 'OWNER' },
        });
      }

      return tx.dealerApplication.update({
        where: { id: application.id },
        data: { ...reviewData, companyId },
        select: this.applicationSelect(),
      });
    });
  }

  /**
   * F-B04 经销商授权目录：在服务层验证企业状态并装配价格候选，
   * 返回值仅包含最终成交价，不暴露其他企业规则或内部优先级。
   */
  async listDealerCatalog(
    quantity: number,
    currentUser: JwtPayload,
    productId?: string,
  ) {
    const company = await this.approvedCompany(currentUser);
    const authorizedBookIds = company.priceBooks.map((item) => item.bookId);
    const currency = String(
      (company.purchaseSettings as Record<string, unknown> | undefined)
        ?.currency ?? 'USD',
    );

    const products = await this.prisma.product.findMany({
      where: {
        AND: [
          catalogWhere(company.catalogPolicy, company.country),
          ...(productId ? [{ id: productId }] : []),
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
        gallery: true,
        variants: {
          where: {
            status: true,
            ...catalogVariantWhere(company.catalogPolicy),
          },
          select: {
            id: true,
            sku: true,
            name: true,
            attrs: true,
            b2bDefaultPriceCents: true,
            msrpCents: true,
            salePriceCents: true,
            weightGrams: true,
            stock: { select: { available: true, syncError: true } },
            marketInventory: {
              where: { market: company.country },
              select: { available: true, syncError: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const variantIds = products.flatMap((product) =>
      product.variants.map((variant) => variant.id),
    );
    const scopeFilters: Prisma.PricingRuleWhereInput[] = [
      { scope: 'COMPANY_SPECIFIC', companyId: company.id },
      { scope: 'PRICE_TABLE', bookId: { in: authorizedBookIds } },
      { scope: 'B2B_DEFAULT' },
    ];
    if (company.tierId) {
      scopeFilters.push({ scope: 'TIER_LEVEL', tierId: company.tierId });
    }
    const rules = variantIds.length
      ? await this.prisma.pricingRule.findMany({
          where: {
            variantId: { in: variantIds },
            active: true,
            minQty: { lte: 10000 },
            OR: scopeFilters,
          },
          select: {
            id: true,
            variantId: true,
            scope: true,
            priority: true,
            companyId: true,
            bookId: true,
            tierId: true,
            priceCents: true,
            minQty: true,
            market: true,
            currency: true,
            startsAt: true,
            endsAt: true,
          },
        })
      : [];
    const rulesByVariant = new Map<string, PricingRuleCandidate[]>();
    for (const { variantId, ...rule } of rules) {
      const candidates = rulesByVariant.get(variantId) ?? [];
      candidates.push(rule);
      rulesByVariant.set(variantId, candidates);
    }

    return products
      .map((product) => ({
        ...product,
        variants: product.variants
          .map((variant) => {
            const resolved = this.pricing.dealer(
              rulesByVariant.get(variant.id) ?? [],
              {
                companyId: company.id,
                tierId: company.tierId,
                authorizedBookIds,
                quantity,
                market: company.country,
                currency,
              },
            );
            let effectiveQuantity = quantity;
            let price =
              resolved ??
              (variant.b2bDefaultPriceCents == null || currency !== 'USD'
                ? null
                : {
                    priceCents: variant.b2bDefaultPriceCents,
                    source: 'B2B_DEFAULT' as const,
                  });
            if (!price) {
              for (const minQty of [
                ...new Set(
                  (rulesByVariant.get(variant.id) ?? []).map(
                    (rule) => rule.minQty,
                  ),
                ),
              ].sort((a, b) => a - b)) {
                const candidate = this.pricing.dealer(
                  rulesByVariant.get(variant.id) ?? [],
                  {
                    companyId: company.id,
                    tierId: company.tierId,
                    authorizedBookIds,
                    quantity: minQty,
                    market: company.country,
                    currency,
                  },
                );
                if (candidate) {
                  price = candidate;
                  effectiveQuantity = minQty;
                  break;
                }
              }
            }
            if (!price) return null;
            const {
              b2bDefaultPriceCents: _hidden,
              stock,
              marketInventory,
              ...safeVariant
            } = variant;
            const available = Math.min(
              stock?.available ?? 0,
              marketInventory?.[0]?.available ?? Infinity,
            );
            const stale = stock?.syncError || marketInventory?.[0]?.syncError;
            const rule = purchaseRule(company.purchaseSettings, variant.sku);
            const priceBreaks = [
              ...new Set([
                1,
                ...(rulesByVariant.get(variant.id) ?? []).map((r) => r.minQty),
              ]),
            ]
              .sort((a, b) => a - b)
              .flatMap((minQty) => {
                const tier =
                  this.pricing.dealer(rulesByVariant.get(variant.id) ?? [], {
                    companyId: company.id,
                    tierId: company.tierId,
                    authorizedBookIds,
                    quantity: minQty,
                    market: company.country,
                    currency,
                  }) ??
                  (variant.b2bDefaultPriceCents != null && currency === 'USD'
                    ? {
                        priceCents: variant.b2bDefaultPriceCents,
                        source: 'B2B_DEFAULT',
                      }
                    : null);
                return tier
                  ? [{ minQty, priceCents: tier.priceCents, currency }]
                  : [];
              })
              .filter(
                (tier, index, all) =>
                  index === 0 || tier.priceCents !== all[index - 1].priceCents,
              );
            return {
              ...safeVariant,
              available:
                stale ||
                ['HIDDEN', 'STATUS'].includes(String(rule.inventoryDisplay))
                  ? null
                  : available,
              availability: stale
                ? 'CHECK_AVAILABILITY'
                : available > 0
                  ? 'IN_STOCK'
                  : 'LEAD_TIME',
              quantity: effectiveQuantity,
              priceBreaks,
              price: {
                ...price,
                currency,
                validUntil:
                  rules.find((r) => r.id === price.ruleId)?.endsAt ?? null,
              },
              purchaseRules: purchaseRule(
                company.purchaseSettings,
                variant.sku,
              ),
            };
          })
          .filter((variant) => variant !== null),
      }))
      .filter((product) => product.variants.length > 0);
  }

  /**
   * M1/MB：Quick Order 逐行预览；RFQ 创建复用校验，接受报价时事务内重新检查库存。
   */
  async validateQuickOrder(
    lines: QuickOrderLineDto[],
    currentUser: JwtPayload,
  ) {
    const company = await this.approvedCompany(currentUser);
    const market = (await this.prisma.retailMarket.findUnique({
      where: { code: company.country },
    })) ?? { code: company.country };
    const authorizedBookIds = company.priceBooks.map((item) => item.bookId);
    const currency = String(
      (company.purchaseSettings as Record<string, unknown> | undefined)
        ?.currency ?? 'USD',
    );
    const normalized = lines.map((line, index) => ({
      row: index + 1,
      sku: line.sku.trim().toUpperCase(),
      quantity: line.quantity,
    }));
    const skuSet = new Set<string>();
    const variants = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: [...new Set(normalized.map((line) => line.sku))] },
        ...catalogVariantWhere(company.catalogPolicy),
        status: true,
        product: {
          ...catalogWhere(company.catalogPolicy, company.country),
        },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        b2bDefaultPriceCents: true,
        availabilityPolicy: true,
        backorderLimit: true,
        leadTimeDays: true,
        stock: { select: { available: true, syncError: true } },
        marketInventory: {
          where: { market: company.country },
          select: { market: true, available: true, syncError: true },
        },
        product: { select: { name: true } },
      },
    });
    const bySku = new Map(
      variants.map((variant) => [variant.sku.toUpperCase(), variant]),
    );
    const rules = variants.length
      ? await this.prisma.pricingRule.findMany({
          where: {
            variantId: { in: variants.map((variant) => variant.id) },
            active: true,
            OR: [
              { scope: 'COMPANY_SPECIFIC', companyId: company.id },
              { scope: 'PRICE_TABLE', bookId: { in: authorizedBookIds } },
              ...(company.tierId
                ? [{ scope: 'TIER_LEVEL' as const, tierId: company.tierId }]
                : []),
              { scope: 'B2B_DEFAULT' },
            ],
          },
          select: {
            id: true,
            variantId: true,
            scope: true,
            priority: true,
            companyId: true,
            bookId: true,
            tierId: true,
            priceCents: true,
            minQty: true,
            market: true,
            currency: true,
            startsAt: true,
            endsAt: true,
          },
        })
      : [];
    const rulesByVariant = new Map<string, PricingRuleCandidate[]>();
    for (const { variantId, ...rule } of rules) {
      const candidates = rulesByVariant.get(variantId) ?? [];
      candidates.push(rule);
      rulesByVariant.set(variantId, candidates);
    }

    const results = normalized.map((line) => {
      if (skuSet.has(line.sku)) {
        return {
          ...line,
          ok: false as const,
          code: 'DUPLICATE_SKU',
          message: 'SKU is duplicated in this upload.',
        };
      }
      skuSet.add(line.sku);
      const variant = bySku.get(line.sku);
      if (!variant) {
        return {
          ...line,
          ok: false as const,
          code: 'SKU_NOT_FOUND_OR_UNAUTHORIZED',
          message: 'SKU does not exist or is not authorized.',
        };
      }
      const resolved =
        this.pricing.dealer(rulesByVariant.get(variant.id) ?? [], {
          companyId: company.id,
          tierId: company.tierId,
          authorizedBookIds,
          quantity: line.quantity,
          market: company.country,
          currency,
        }) ??
        (variant.b2bDefaultPriceCents == null || currency !== 'USD'
          ? null
          : {
              priceCents: variant.b2bDefaultPriceCents,
              source: 'B2B_DEFAULT' as const,
            });
      if (!resolved) {
        return {
          ...line,
          ok: false as const,
          code: 'NO_AUTHORIZED_PRICE',
          message: 'No authorized dealer price is available.',
        };
      }
      const inventory = inventoryAvailability(
        { ...variant, stock: variant.stock ?? null },
        market,
      );
      const available = Math.max(0, inventory.available);
      if (variant.stock?.syncError || variant.marketInventory?.[0]?.syncError)
        return {
          ...line,
          ok: false as const,
          code: 'CHECK_AVAILABILITY',
          message:
            'Inventory needs confirmation; please contact sales before ordering.',
        };
      const rule = purchaseRule(company.purchaseSettings, line.sku);
      rule.leadTimeDays = Math.max(
        rule.leadTimeDays,
        variant.leadTimeDays ?? 0,
      );
      if (
        line.quantity < rule.moq ||
        line.quantity % rule.multiple !== 0 ||
        line.quantity % rule.caseSize !== 0
      ) {
        return {
          ...line,
          ok: false as const,
          code: 'PURCHASE_RULE',
          message: `MOQ ${rule.moq}; quantity multiple ${rule.multiple}; case size ${rule.caseSize}.`,
        };
      }
      if (inventory.capacity < line.quantity) {
        return {
          ...line,
          ok: false as const,
          code: 'INSUFFICIENT_STOCK',
          message:
            rule.inventoryDisplay === 'EXACT' || !rule.inventoryDisplay
              ? `Only ${available} units are currently available.`
              : 'Requested quantity is unavailable; contact sales for lead time.',
        };
      }
      return {
        ...line,
        ok: true as const,
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        unitPriceCents: resolved.priceCents,
        priceSource: resolved.source,
        lineTotalCents: resolved.priceCents * line.quantity,
        available:
          rule.inventoryDisplay === 'HIDDEN' ||
          rule.inventoryDisplay === 'STATUS'
            ? null
            : available,
        availability: inventory.availability ?? 'HIDDEN',
        purchaseRules: rule,
      };
    });
    const accepted = results.filter((line) => line.ok);
    return {
      companyId: company.id,
      currency,
      results,
      valid: results.every((line) => line.ok),
      totalCents: accepted.reduce(
        (total, line) => total + line.lineTotalCents,
        0,
      ),
    };
  }

  private async approvedCompany(currentUser: JwtPayload) {
    if (
      !this.pricing.canViewDealerPrice(currentUser) ||
      currentUser.kind !== 'customer' ||
      !currentUser.companyId
    ) {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'approved dealer membership is required',
        403,
      );
    }
    const company = await this.prisma.dealerCompany.findFirst({
      where: {
        id: currentUser.companyId,
        status: 'APPROVED',
        members: {
          some: {
            userId: currentUser.sub,
            active: true,
            user: { status: 'ACTIVE' },
          },
        },
      },
      select: {
        id: true,
        tierId: true,
        country: true,
        catalogPolicy: true,
        purchaseSettings: true,
        priceBooks: { select: { bookId: true } },
      },
    });
    if (!company) {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'dealer company is not approved',
        403,
      );
    }
    return company;
  }

  private applicationSelect() {
    return {
      id: true,
      companyId: true,
      applicantId: true,
      companyName: true,
      legalRegNo: true,
      contactName: true,
      contactEmail: true,
      phone: true,
      country: true,
      businessType: true,
      attachments: true,
      agreementVersion: true,
      agreedAt: true,
      status: true,
      remark: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}

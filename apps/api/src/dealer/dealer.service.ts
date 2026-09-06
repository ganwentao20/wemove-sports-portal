import { Injectable } from '@nestjs/common';
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
    if (count !== null && count > APPLICATION_RATE_LIMIT.max) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many dealer applications, slow down',
        429,
      );
    }

    const contactEmail = dto.contactEmail.trim().toLowerCase();

    // 同一联系邮箱已有在途申请 → 409（防重复刷单）
    const duplicateByEmail = await this.prisma.dealerApplication.findFirst({
      where: {
        contactEmail,
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
          where: { id: { in: mediaIds }, visibility: 'DEALER_ONLY' },
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
      },
      select: this.applicationSelect(),
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
  async listDealerCatalog(quantity: number, currentUser: JwtPayload) {
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
      where: { id: currentUser.companyId, status: 'APPROVED' },
      select: { id: true, tierId: true },
    });
    if (!company) {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'dealer company is not approved',
        403,
      );
    }

    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
        gallery: true,
        variants: {
          where: { status: true },
          select: {
            id: true,
            sku: true,
            name: true,
            attrs: true,
            b2bDefaultPriceCents: true,
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
            minQty: { lte: quantity },
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
                quantity,
              },
            );
            const price =
              resolved ??
              (variant.b2bDefaultPriceCents == null
                ? null
                : {
                    priceCents: variant.b2bDefaultPriceCents,
                    source: 'B2B_DEFAULT' as const,
                  });
            if (!price) return null;
            const { b2bDefaultPriceCents: _hidden, ...safeVariant } = variant;
            return { ...safeVariant, quantity, price };
          })
          .filter((variant) => variant !== null),
      }))
      .filter((product) => product.variants.length > 0);
  }

  /**
   * Quick Order preview deliberately stops before persistence: company RFQ/PO ownership and
   * lifecycle require the team-approved enterprise order schema. Each requested row still gets
   * an explicit authorization/stock/price result so the flow is demonstrable and safe.
   */
  async validateQuickOrder(
    lines: QuickOrderLineDto[],
    currentUser: JwtPayload,
  ) {
    const company = await this.approvedCompany(currentUser);
    const normalized = lines.map((line, index) => ({
      row: index + 1,
      sku: line.sku.trim().toUpperCase(),
      quantity: line.quantity,
    }));
    const skuSet = new Set<string>();
    const variants = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: [...new Set(normalized.map((line) => line.sku))] },
        status: true,
        product: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        b2bDefaultPriceCents: true,
        stock: { select: { available: true } },
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
          quantity: line.quantity,
        }) ??
        (variant.b2bDefaultPriceCents == null
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
      const available = variant.stock?.available ?? 0;
      if (available < line.quantity) {
        return {
          ...line,
          ok: false as const,
          code: 'INSUFFICIENT_STOCK',
          message: `Only ${available} units are currently available.`,
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
        available,
      };
    });
    const accepted = results.filter((line) => line.ok);
    return {
      companyId: company.id,
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
      where: { id: currentUser.companyId, status: 'APPROVED' },
      select: { id: true, tierId: true },
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
      status: true,
      remark: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}

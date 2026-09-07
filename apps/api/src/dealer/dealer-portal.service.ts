import { directorySnapshot } from './directory-policy.js';
import { Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DealerService } from './dealer.service.js';
import { B2bService } from './b2b.service.js';
import type {
  CompanyAddressDto,
  CompanyPolicyDto,
  CompanyProfileDto,
  InviteDto,
  MemberDto,
} from './dto/portal.dto.js';
import type { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const json = (value: object) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
function fail(message: string, status = 403): never {
  throw new BizException(
    status === 403 ? ERROR_CODES.FORBIDDEN : ERROR_CODES.VALIDATION,
    message,
    status,
  );
}

@Injectable()
export class DealerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dealer: DealerService,
    private readonly b2b: B2bService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}
  private async account(actor: JwtPayload) {
    if (actor.kind !== 'customer') fail('customer account required');
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
    });
    if (!user || user.status !== 'ACTIVE')
      fail('verified active email required');
    return user;
  }
  async applications(actor: JwtPayload) {
    await this.account(actor);
    return this.prisma.dealerApplication.findMany({
      where: { applicantId: actor.sub },
      select: {
        id: true,
        companyName: true,
        status: true,
        remark: true,
        updatedAt: true,
      },
    });
  }
  async claim(actor: JwtPayload, id: string, token: string) {
    const user = await this.account(actor);
    const count = await this.prisma.dealerApplication.updateMany({
      where: {
        id,
        applicantId: null,
        contactEmail: user.email,
        claimTokenHash: hash(token),
        claimExpiresAt: { gt: new Date() },
      },
      data: {
        applicantId: user.id,
        claimTokenHash: null,
        claimExpiresAt: null,
      },
    });
    if (count.count !== 1)
      fail('claim link is expired, used or belongs to another verified email');
    return this.dealer.findApplication(id, actor);
  }
  async resendClaim(actor: JwtPayload, id: string) {
    const user = await this.account(actor);
    const application = await this.prisma.dealerApplication.findFirst({
      where: { id, applicantId: null, contactEmail: user.email },
    });
    // Keep the response identical for unrelated accounts and already claimed applications.
    if (!application) return { ok: true };
    if (
      application.claimExpiresAt &&
      application.claimExpiresAt.getTime() > Date.now() + 7 * 86400000 - 60000
    )
      return { ok: true };
    const token = randomBytes(32).toString('hex');
    const updated = await this.prisma.dealerApplication.updateMany({
      where: {
        id,
        applicantId: null,
        contactEmail: user.email,
        claimTokenHash: application.claimTokenHash,
      },
      data: {
        claimTokenHash: hash(token),
        claimExpiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    if (updated.count === 1)
      await this.notifications?.enqueue({
        kind: 'dealer.application.claim',
        to: user.email,
        subject: 'Your dealer application claim link',
        text: `Claim your application: ${process.env.APP_BASE_URL ?? process.env.WEB_URL ?? 'http://localhost:3000'}/dealer/application?application=${id}#claim=${token}`,
        dedupeKey: `application:${id}:claim:${hash(token)}`,
      });
    return { ok: true };
  }
  async clearDraft(actor: JwtPayload) {
    await this.account(actor);
    await this.prisma.dealerApplicationDraft.deleteMany({
      where: { userId: actor.sub },
    });
    return { ok: true };
  }
  async draft(actor: JwtPayload, data?: Record<string, unknown>) {
    await this.account(actor);
    if (!data)
      return this.prisma.dealerApplicationDraft.findUnique({
        where: { userId: actor.sub },
      });
    if (JSON.stringify(data).length > 30000) fail('draft is too large', 422);
    return this.prisma.dealerApplicationDraft.upsert({
      where: { userId: actor.sub },
      create: { userId: actor.sub, data: json(data) },
      update: { data: json(data) },
    });
  }
  async resubmit(
    actor: JwtPayload,
    id: string,
    dto: CreateDealerApplicationDto,
    ip?: string,
  ) {
    const application = await this.dealer.findApplication(id, actor);
    if (
      application.applicantId !== actor.sub ||
      application.status !== 'MORE_INFO_REQUIRED'
    )
      fail('only the applicant can resubmit a requested correction');
    const ids = dto.attachments.map((a) => a.mediaId);
    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        id: { in: ids },
        visibility: 'DEALER_ONLY',
        qualification: true,
        scanStatus: {
          in:
            process.env.MEDIA_SCAN_REQUIRED === 'true'
              ? ['CLEAN']
              : ['CLEAN', 'SIGNATURE_CHECKED', 'LEGACY_UNSCANNED'],
        },
      },
    });
    if (
      assets.length !== ids.length ||
      dto.attachments.some(
        (a) =>
          !assets.some(
            (m) => m.id === a.mediaId && m.key === a.attachmentToken,
          ),
      )
    )
      fail('invalid qualification attachment', 422);
    const prior = Array.isArray(application.attachments)
      ? (application.attachments as Array<Record<string, Prisma.JsonValue>>)
      : [];
    const replacements = dto.attachments.map((a) => ({
      mediaId: a.mediaId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      visibility: 'PRIVATE',
    }));
    const attachments = [
      ...prior.filter(
        (p) => !replacements.some((a) => a.mediaId === p.mediaId),
      ),
      ...replacements,
    ];
    if (attachments.length > 8)
      fail('application cannot contain more than eight attachments', 422);
    const updated = await this.prisma.dealerApplication.updateMany({
      where: { id, applicantId: actor.sub, status: 'MORE_INFO_REQUIRED' },
      data: {
        companyName: dto.companyName,
        legalRegNo: dto.legalRegNo,
        contactName: dto.contactName,
        phone: dto.phone,
        country: dto.country,
        businessType: dto.businessType,
        attachments: json(attachments),
        status: 'SUBMITTED',
        agreementVersion: dto.agreementVersion ?? 'dealer-2026-09',
        agreedAt: new Date(),
        consentIp: ip,
      },
    });
    if (updated.count !== 1) fail('application was changed; refresh', 409);
    await this.notifications?.enqueue({
      kind: 'dealer.application.resubmit',
      to: application.contactEmail,
      subject: 'Dealer application resubmitted',
      text: `Application ${id} has been returned to review.`,
      dedupeKey: `resubmit:${id}:${Date.now()}`,
    });
    return this.dealer.findApplication(id, actor);
  }
  async overview(actor: JwtPayload, companyId?: string) {
    const company =
      actor.kind === 'staff' && companyId
        ? {
            ...(await this.prisma.dealerCompany.findUniqueOrThrow({
              where: { id: companyId },
            })),
            role: 'OWNER',
          }
        : await this.b2b.company(actor);
    const [members, addresses, invitations] = await Promise.all([
      this.prisma.dealerMember.findMany({
        where: { companyId: company.id },
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      }),
      this.prisma.dealerAddress.findMany({ where: { companyId: company.id } }),
      company.role === 'OWNER'
        ? this.prisma.dealerInvitation.findMany({
            where: { companyId: company.id, consumedAt: null },
            select: { id: true, email: true, role: true, expiresAt: true },
          })
        : Promise.resolve([]),
    ]);
    return { company, members, addresses, invitations };
  }
  async dashboard(actor: JwtPayload) {
    const company = await this.b2b.company(actor);
    const [tier, pendingQuotes, awaitingReview, unpaidOrders, quotes, orders] =
      await Promise.all([
        company.tierId
          ? this.prisma.dealerTier.findUnique({
              where: { id: company.tierId },
              select: { name: true, code: true },
            })
          : null,
        this.prisma.dealerRfq.count({
          where: {
            companyId: company.id,
            status: 'QUOTED',
            quotes: { some: { validUntil: { gt: new Date() } } },
          },
        }),
        this.prisma.purchaseOrder.count({
          where: { companyId: company.id, status: 'PENDING_REVIEW' },
        }),
        this.prisma.purchaseOrder.count({
          where: {
            companyId: company.id,
            status: { not: 'CANCELLED' },
            paymentStatus: { not: 'PAID' },
          },
        }),
        this.prisma.dealerRfq.findMany({
          where: {
            companyId: company.id,
            status: { in: ['DRAFT', 'SUBMITTED', 'QUOTED'] },
          },
          orderBy: { updatedAt: 'desc' },
          take: 6,
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            quotes: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { validUntil: true, totalCents: true, currency: true },
            },
          },
        }),
        this.prisma.purchaseOrder.findMany({
          where: { companyId: company.id },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            orderNo: true,
            status: true,
            paymentStatus: true,
            currency: true,
            totalCents: true,
            createdAt: true,
          },
        }),
      ]);
    return {
      company: {
        id: company.id,
        companyName: company.companyName,
        status: company.status,
        country: company.country,
        role: company.role,
        profile: company.profile,
        catalogPolicy: company.catalogPolicy,
        purchaseSettings: company.purchaseSettings,
        tier,
      },
      counts: { pendingQuotes, awaitingReview, unpaidOrders },
      quotes,
      orders,
    };
  }

  private async owner(actor: JwtPayload, companyId?: string) {
    if (actor.kind === 'staff' && companyId)
      return this.prisma.dealerCompany.findUniqueOrThrow({
        where: { id: companyId },
      });
    const company = await this.b2b.company(actor);
    if (company.role !== 'OWNER') fail('company owner required');
    return company;
  }
  async profile(actor: JwtPayload, dto: CompanyProfileDto, companyId?: string) {
    const c = await this.owner(actor, companyId);
    if (JSON.stringify(dto.profile ?? {}).length > 20000)
      fail('company profile is too large', 422);
    for (const field of [
      'defaultShippingAddressId',
      'defaultBillingAddressId',
    ]) {
      const addressId = dto.profile?.[field];
      if (
        addressId &&
        (typeof addressId !== 'string' ||
          !(await this.prisma.dealerAddress.findFirst({
            where: {
              id: addressId,
              companyId: c.id,
              kind: {
                in: [
                  'BOTH',
                  field === 'defaultShippingAddressId' ? 'SHIPPING' : 'BILLING',
                ],
              },
            },
          })))
      )
        fail(
          'default address must belong to this company and support the selected use',
          422,
        );
    }
    const requested = directorySnapshot(
      dto.profile ?? {},
      dto.companyName,
      c.country,
    );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DealerCompany" WHERE id=${c.id} FOR UPDATE`;
      const current = await tx.dealerCompany.findUniqueOrThrow({
          where: { id: c.id },
        }),
        previous = current.profile as Record<string, unknown>;
      const profile = { ...dto.profile };
      for (const key of [
        'directoryPublished',
        'directorySubmission',
        'directoryReview',
      ]) {
        delete profile[key];
        if (previous[key] !== undefined) profile[key] = previous[key];
      }
      const published = previous.directoryPublished as
        Record<string, unknown> | undefined;
      const comparable = published
        ? directorySnapshot(
            published,
            String(published.companyName ?? current.companyName),
            String(published.country ?? current.country),
          )
        : {};
      if (JSON.stringify(requested) !== JSON.stringify(comparable))
        profile.directorySubmission = {
          ...requested,
          id: randomBytes(16).toString('hex'),
          submittedAt: new Date().toISOString(),
          submittedBy: actor.sub,
        };
      // Opting out immediately removes public visibility; publication always needs review.
      if (requested.publicListing === false && published)
        profile.directoryPublished = { ...published, publicListing: false };
      await tx.auditLog.create({
        data: {
          actorKind: actor.kind === 'staff' ? 'STAFF' : 'CUSTOMER',
          ...(actor.kind === 'staff'
            ? { actorStaffId: actor.sub }
            : { actorCustomerId: actor.sub }),
          action: 'dealer.directory.submitted',
          entityType: 'DealerCompany',
          entityId: c.id,
          after: json({ pending: Boolean(profile.directorySubmission) }),
        },
      });
      return tx.dealerCompany.update({
        where: { id: c.id },
        data: { companyName: dto.companyName, profile: json(profile) },
      });
    });
  }
  async reviewDirectory(
    actor: JwtPayload,
    companyId: string,
    input: { approve: boolean; reason: string; submissionId: string },
  ) {
    if (actor.kind !== 'staff' || input.reason.trim().length < 5)
      fail('Staff review with a meaningful reason is required', 403);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DealerCompany" WHERE id=${companyId} FOR UPDATE`;
      const company = await tx.dealerCompany.findUniqueOrThrow({
          where: { id: companyId },
        }),
        profile = { ...(company.profile as Record<string, unknown>) },
        pending = profile.directorySubmission as
          Record<string, unknown> | undefined;
      if (!pending || pending.id !== input.submissionId)
        fail('Directory submission changed; reload before reviewing', 409);
      if (input.approve) {
        if (company.status !== 'APPROVED')
          fail('Approve the company before publishing a listing', 422);
        profile.directoryPublished = {
          ...directorySnapshot(
            pending,
            String(pending.companyName),
            company.country,
          ),
          reviewedAt: new Date().toISOString(),
          reviewedBy: actor.sub,
        };
      }
      profile.directoryReview = {
        approved: input.approve,
        reason: input.reason.trim(),
        at: new Date().toISOString(),
        by: actor.sub,
      };
      delete profile.directorySubmission;
      await tx.auditLog.create({
        data: {
          actorKind: 'STAFF',
          actorStaffId: actor.sub,
          action: 'dealer.directory.reviewed',
          entityType: 'DealerCompany',
          entityId: companyId,
          after: json({
            approved: input.approve,
            reason: input.reason.trim(),
            submissionId: input.submissionId,
          }),
        },
      });
      return tx.dealerCompany.update({
        where: { id: companyId },
        data: { profile: json(profile) },
      });
    });
  }
  async address(
    actor: JwtPayload,
    dto: CompanyAddressDto,
    id?: string,
    companyId?: string,
  ) {
    const c = await this.owner(actor, companyId);
    if (id) {
      const found = await this.prisma.dealerAddress.findFirst({
        where: { id, companyId: c.id },
      });
      if (!found) fail('address not found', 404);
    }
    return id
      ? this.prisma.dealerAddress.update({
          where: { id },
          data: {
            label: dto.label,
            kind: dto.kind,
            address: json(dto.address),
          },
        })
      : this.prisma.dealerAddress.create({
          data: {
            companyId: c.id,
            label: dto.label,
            kind: dto.kind,
            address: json(dto.address),
          },
        });
  }
  async removeAddress(actor: JwtPayload, id: string, companyId?: string) {
    const c = await this.owner(actor, companyId);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.dealerAddress.deleteMany({
        where: { id, companyId: c.id },
      });
      if (result.count) {
        const profile = { ...(c.profile as Prisma.JsonObject) };
        for (const field of [
          'defaultShippingAddressId',
          'defaultBillingAddressId',
        ])
          if (profile[field] === id) delete profile[field];
        await tx.dealerCompany.update({
          where: { id: c.id },
          data: { profile: json(profile) },
        });
      }
      return result;
    });
  }
  async invite(actor: JwtPayload, dto: InviteDto, companyId?: string) {
    const c = await this.owner(actor, companyId);
    if (
      await this.prisma.dealerMember.findFirst({
        where: {
          companyId: c.id,
          active: true,
          user: { email: dto.email.trim().toLowerCase() },
        },
      })
    )
      fail('this account is already an active company member', 422);
    const token = randomBytes(32).toString('hex');
    const invitation = await this.prisma.dealerInvitation.create({
      data: {
        companyId: c.id,
        email: dto.email.trim().toLowerCase(),
        role: dto.role,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    await this.notifications?.enqueue({
      kind: 'dealer.team.invitation',
      to: invitation.email,
      subject: `Join ${c.companyName}`,
      text: `Register and verify your email, then accept: ${process.env.APP_BASE_URL ?? process.env.WEB_URL ?? 'http://localhost:3000'}/dealer/company#invitation=${token}`,
      dedupeKey: `invitation:${invitation.id}`,
    });
    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }
  async acceptInvitation(actor: JwtPayload, token: string) {
    const user = await this.account(actor);
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.dealerInvitation.findUnique({
        where: { tokenHash: hash(token) },
        include: { company: true },
      });
      if (
        !invitation ||
        invitation.email !== user.email ||
        invitation.consumedAt ||
        invitation.expiresAt < new Date() ||
        invitation.company.status !== 'APPROVED'
      )
        fail('invitation invalid or belongs to another verified email');
      const existing = await tx.dealerMember.findFirst({
        where: {
          userId: user.id,
          active: true,
        },
      });
      if (existing) fail('account already has an active company membership');
      const consumed = await tx.dealerInvitation.updateMany({
        where: { id: invitation.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) fail('invitation already used');
      await tx.dealerMember.upsert({
        where: {
          companyId_userId: {
            companyId: invitation.companyId,
            userId: user.id,
          },
        },
        create: {
          companyId: invitation.companyId,
          userId: user.id,
          role: invitation.role,
        },
        update: { role: invitation.role, active: true },
      });
      return {
        ok: true,
        message: 'Invitation accepted. Sign in to the dealer portal.',
      };
    });
  }
  async member(
    actor: JwtPayload,
    userId: string,
    dto: MemberDto,
    companyId?: string,
  ) {
    const c = await this.owner(actor, companyId);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DealerCompany" WHERE "id" = ${c.id} FOR UPDATE`;
      const current = await tx.dealerMember.findUnique({
        where: { companyId_userId: { companyId: c.id, userId } },
      });
      if (!current) fail('member not found', 404);
      if (
        current.role === 'OWNER' &&
        current.active &&
        (!dto.active || dto.role !== 'OWNER') &&
        (await tx.dealerMember.count({
          where: { companyId: c.id, role: 'OWNER', active: true },
        })) < 2
      )
        fail('retain at least one active owner', 422);
      const updated = await tx.dealerMember.update({
        where: { companyId_userId: { companyId: c.id, userId } },
        data: dto,
      });
      await tx.auditLog.create({
        data: {
          actorKind: actor.kind === 'staff' ? 'STAFF' : 'CUSTOMER',
          ...(actor.kind === 'staff'
            ? { actorStaffId: actor.sub }
            : { actorCustomerId: actor.sub }),
          action: 'dealer.member.update',
          entityType: 'DealerMember',
          entityId: `${c.id}:${userId}`,
          before: { role: current.role, active: current.active },
          after: json(dto),
        },
      });
      return updated;
    });
    if (!dto.active) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user)
        await this.notifications?.enqueue({
          kind: 'dealer.team.disabled',
          to: user.email,
          subject: 'Your company membership has been disabled',
          text: `Your membership in ${c.companyName} has been disabled. Contact your company owner for assistance.`,
          dedupeKey: `dealer.member.disabled:${c.id}:${userId}:${Date.now()}`,
        });
    }
    return result;
  }
  async policies() {
    return this.prisma.dealerCompany.findMany({
      orderBy: { companyName: 'asc' },
    });
  }
  async policyOptions() {
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          variants: { select: { id: true, sku: true } },
        },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      this.prisma.productCategory.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);
    return { products, categories };
  }
  async policy(actor: JwtPayload, id: string, dto: CompanyPolicyDto) {
    for (const field of [
      'productIds',
      'variantIds',
      'categoryIds',
      'markets',
      'channels',
    ]) {
      const v = dto.catalogPolicy[field];
      if (
        v !== undefined &&
        (!Array.isArray(v) ||
          v.length > 500 ||
          v.some((x) => typeof x !== 'string'))
      )
        fail(`invalid ${field}`, 422);
    }
    const settings = dto.purchaseSettings;
    if (
      settings.reserveAt !== undefined &&
      !['SUBMIT', 'CONFIRM'].includes(String(settings.reserveAt))
    )
      fail('invalid inventory reservation time', 422);
    for (const field of [
      'moq',
      'multiple',
      'caseSize',
      'leadTimeDays',
      'caseWeightGrams',
    ]) {
      const v = settings[field];
      if (
        v !== undefined &&
        (!Number.isInteger(v) ||
          Number(v) < (field === 'leadTimeDays' ? 0 : 1) ||
          Number(v) > 100000)
      )
        fail(`invalid ${field}`, 422);
    }
    if (
      settings.inventoryDisplay !== undefined &&
      !['EXACT', 'STATUS', 'HIDDEN'].includes(String(settings.inventoryDisplay))
    )
      fail('invalid inventoryDisplay', 422);
    for (const field of ['requirePoNumber', 'orderSuspended', 'requireMfa'])
      if (settings[field] !== undefined && typeof settings[field] !== 'boolean')
        fail(`invalid ${field}`, 422);
    if (
      settings.currency !== undefined &&
      !/^[A-Z]{3}$/.test(String(settings.currency))
    )
      fail('currency must be an ISO three-letter code', 422);
    if (
      settings.paymentMethods !== undefined &&
      (!Array.isArray(settings.paymentMethods) ||
        !settings.paymentMethods.length ||
        settings.paymentMethods.some(
          (v) =>
            !['CARD', 'BANK_TRANSFER', 'PO', 'ACCOUNT'].includes(String(v)),
        ))
    )
      fail('invalid allowed payment methods', 422);
    if (settings.skus !== undefined) {
      if (
        !settings.skus ||
        typeof settings.skus !== 'object' ||
        Array.isArray(settings.skus)
      )
        fail('invalid SKU purchase rules', 422);
      for (const rule of Object.values(settings.skus)) {
        if (!rule || typeof rule !== 'object')
          fail('invalid SKU purchase rule', 422);
        for (const [k, v] of Object.entries(rule))
          if (
            ![
              'moq',
              'multiple',
              'caseSize',
              'leadTimeDays',
              'caseWeightGrams',
            ].includes(k) ||
            !Number.isInteger(v) ||
            Number(v) < (k === 'leadTimeDays' ? 0 : 1) ||
            Number(v) > 100000
          )
            fail('invalid SKU purchase rule', 422);
      }
    }
    const before = await this.prisma.dealerCompany.findUniqueOrThrow({
      where: { id },
    });
    const updated = await this.prisma.dealerCompany.update({
      where: { id },
      data: {
        catalogPolicy: json(dto.catalogPolicy),
        purchaseSettings: json(settings),
        status: dto.status,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorKind: 'STAFF',
        actorStaffId: actor.sub,
        action: 'dealer.company.policy',
        entityType: 'dealerCompany',
        entityId: id,
        before: json({
          status: before.status,
          catalogPolicy: before.catalogPolicy,
          purchaseSettings: before.purchaseSettings,
        }),
        after: json(dto),
      },
    });
    if (before.status !== updated.status) {
      const members = await this.prisma.dealerMember.findMany({
        where: { companyId: id, active: true },
        include: { user: { select: { email: true } } },
      });
      for (const member of members)
        await this.notifications?.enqueue({
          kind: 'dealer.company.status',
          to: member.user.email,
          subject: 'Company account ' + updated.status,
          text:
            updated.companyName +
            ' account status: ' +
            updated.status +
            '. Contact your business representative for details.',
          variables: { reference: id, status: updated.status },
          dedupeKey:
            'dealer.company.status:' +
            id +
            ':' +
            updated.updatedAt.toISOString() +
            ':' +
            member.userId,
          internalGroup: 'dealer',
        });
    }
    return updated;
  }
}

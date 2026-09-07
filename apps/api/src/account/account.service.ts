import { createHash, randomBytes } from 'node:crypto';
import { MediaService } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MfaService } from '../mfa/mfa.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { hashPassword, verifyPassword } from '../auth/passwords.util.js';
import { AuthService, type JwtPayload } from '../auth/auth.service.js';
import type {
  AddressDto,
  ProfileDto,
  AccountPasswordDto,
  PrivacyRequestDto,
  ResolvePrivacyDto,
  AccountAdminQueryDto,
} from './account.dto.js';
const profileSelect = {
  id: true,
  email: true,
  name: true,
  displayName: true,
  phone: true,
  country: true,
  locale: true,
  productUpdates: true,
  marketingEmail: true,
  marketingSms: true,
  mfaEnabled: true,
  status: true,
  termsVersion: true,
  privacyVersion: true,
  policiesAgreedAt: true,
  createdAt: true,
} as const;
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly auth?: AuthService,
    @Optional() private readonly media?: MediaService,
  ) {}
  customer(actor: JwtPayload) {
    if (actor.kind !== 'customer')
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'customer account required',
        403,
      );
    return actor.sub;
  }
  async profile(actor: JwtPayload) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: this.customer(actor) },
      select: profileSelect,
    });
  }
  async updateProfile(actor: JwtPayload, dto: ProfileDto) {
    if (dto.name.trim().length < 2)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'Name needs meaningful text',
        400,
      );
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: this.customer(actor) },
      select: { email: true, privacyVersion: true },
    });
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`newsletter:${user.email}`},0))`;
      const profile = await tx.user.update({
        where: { id: actor.sub },
        data: { ...dto, name: dto.name.trim() },
        select: profileSelect,
      });
      const current = await tx.newsletterSubscription.findUnique({
        where: { email: user.email },
      });
      if (dto.marketingEmail) {
        const tokenHash =
          current?.status === 'ACTIVE'
            ? current.tokenHash
            : createHash('sha256').update(randomBytes(32)).digest('hex');
        await tx.newsletterSubscription.upsert({
          where: { email: user.email },
          create: {
            email: user.email,
            status: 'ACTIVE',
            locale: dto.locale,
            tokenHash,
            consentVersion: user.privacyVersion ?? 'privacy-2026-09',
            expiresAt: new Date(Date.now() + 86400_000),
          },
          update: {
            status: 'ACTIVE',
            locale: dto.locale,
            tokenHash,
            consentVersion: user.privacyVersion ?? 'privacy-2026-09',
            expiresAt: new Date(Date.now() + 86400_000),
          },
        });
      } else if (current && current.status !== 'UNSUBSCRIBED') {
        await tx.newsletterSubscription.update({
          where: { email: user.email },
          data: { status: 'UNSUBSCRIBED' },
        });
        await this.notifications?.enqueue(
          {
            kind: 'newsletter.unsubscribed',
            to: user.email,
            locale: dto.locale,
            internalGroup: false,
            subject: 'Your WEMOVE subscription is cancelled',
            text: 'Marketing emails are cancelled. Account, order and support messages remain available.',
            dedupeKey: `account:${actor.sub}:newsletter-unsubscribe:${current.tokenHash}`,
          },
          tx,
        );
      }
      return profile;
    });
    await this.record(actor, 'account.profile.updated', actor.sub, {
      marketingEmail: dto.marketingEmail,
      marketingSms: dto.marketingSms,
    });
    return result;
  }
  async addresses(actor: JwtPayload) {
    return this.prisma.accountAddress.findMany({
      where: { userId: this.customer(actor) },
      orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
    });
  }
  async saveAddress(actor: JwtPayload, dto: AddressDto, id?: string) {
    const userId = this.customer(actor);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (id && !(await tx.accountAddress.findFirst({ where: { id, userId } })))
        this.notFound();
      if (dto.isDefaultBilling)
        await tx.accountAddress.updateMany({
          where: { userId },
          data: { isDefaultBilling: false },
        });
      if (dto.isDefaultShipping)
        await tx.accountAddress.updateMany({
          where: { userId },
          data: { isDefaultShipping: false },
        });
      return id
        ? tx.accountAddress.update({ where: { id }, data: dto })
        : tx.accountAddress.create({ data: { ...dto, userId } });
    });
  }
  async deleteAddress(actor: JwtPayload, id: string) {
    const result = await this.prisma.accountAddress.deleteMany({
      where: { id, userId: this.customer(actor) },
    });
    if (!result.count) this.notFound();
    return { ok: true };
  }
  async favorites(actor: JwtPayload) {
    const favorites = await this.prisma.accountFavorite.findMany({
      where: { userId: this.customer(actor) },
      orderBy: { createdAt: 'desc' },
    });
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: favorites.map((f) => f.productId) },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        summary: true,
        variants: {
          where: { status: true },
          select: {
            id: true,
            sku: true,
            name: true,
            salePriceCents: true,
            msrpCents: true,
          },
        },
      },
    });
    return favorites.map((f) => ({
      ...f,
      product: products.find((p) => p.id === f.productId) ?? null,
    }));
  }
  async favorite(actor: JwtPayload, productId: string, remove = false) {
    const userId = this.customer(actor);
    if (remove) {
      await this.prisma.accountFavorite.deleteMany({
        where: { userId, productId },
      });
      return { ok: true };
    }
    if (
      !(await this.prisma.product.findFirst({
        where: { id: productId, status: 'ACTIVE' },
      }))
    )
      this.notFound();
    return this.prisma.accountFavorite.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
  }
  async sessions(actor: JwtPayload) {
    const rows = await this.prisma.authenticationSession.findMany({
      where: {
        ownerKind: actor.kind,
        ownerId: actor.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        authVersion: actor.authVersion ?? 0,
      },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        mfaVerified: true,
      },
    });
    return rows.map((s) => ({ ...s, current: s.id === actor.jti }));
  }
  async revokeSessions(actor: JwtPayload, id?: string) {
    const result = await this.prisma.authenticationSession.updateMany({
      where: {
        ownerId: actor.sub,
        ownerKind: actor.kind,
        ...(id ? { id } : { id: { not: actor.jti } }),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await this.record(actor, 'account.sessions.revoked', id ?? actor.sub);
    return { revoked: result.count };
  }
  async changePassword(actor: JwtPayload, dto: AccountPasswordDto) {
    const account =
      actor.kind === 'staff'
        ? await this.prisma.staff.findUnique({ where: { id: actor.sub } })
        : await this.prisma.user.findUnique({ where: { id: actor.sub } });
    if (
      !account ||
      !(await verifyPassword(dto.oldPassword, account.passwordHash))
    )
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'current password incorrect',
        400,
      );
    const data = {
      passwordHash: await hashPassword(dto.newPassword),
      authVersion: { increment: 1 },
    };
    if (actor.kind === 'staff')
      await this.prisma.staff.update({ where: { id: actor.sub }, data });
    else await this.prisma.user.update({ where: { id: actor.sub }, data });
    await this.record(actor, 'account.password.changed', actor.sub);
    await this.notifications?.enqueue({
      kind: 'account.password-changed',
      to: account.email,
      subject: 'Your WEMOVE password changed',
      text: 'Your password changed and all previous sessions were revoked. Contact support immediately if this was not you.',
      dedupeKey: `password-changed:${actor.kind}:${actor.sub}:${account.authVersion + 1}`,
    });
    return { ok: true, signInRequired: true };
  }
  async exportData(actor: JwtPayload) {
    const userId = this.customer(actor);
    const [
      profile,
      addresses,
      favorites,
      orders,
      applications,
      privacyRequests,
      sessions,
      applicationDraft,
      procurementCart,
    ] = await Promise.all([
      this.profile(actor),
      this.addresses(actor),
      this.favorites(actor),
      this.prisma.order.findMany({
        where: { userId },
        include: { items: true },
      }),
      this.prisma.dealerApplication.findMany({
        where: { applicantId: userId },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          contactEmail: true,
          phone: true,
          country: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.accountPrivacyRequest.findMany({ where: { userId } }),
      this.sessions(actor),
      this.prisma.dealerApplicationDraft.findUnique({ where: { userId } }),
      this.prisma.dealerProcurementCart.findUnique({ where: { userId } }),
    ]);
    const [
      newsletter,
      contacts,
      dealerTerms,
      retailReturns,
      retailRefunds,
      dealerReturns,
      dealerRefunds,
    ] = await Promise.all([
      this.prisma.newsletterSubscription.findUnique({
        where: { email: profile.email },
        select: {
          email: true,
          status: true,
          locale: true,
          consentVersion: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.contactMessage.findMany({
        where: { email: profile.email },
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          content: true,
          country: true,
          source: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.dealerMember.findMany({
        where: { userId },
        select: {
          companyId: true,
          termsVersion: true,
          termsAcceptedAt: true,
          termsAcceptedIp: true,
        },
      }),
      this.prisma.retailReturn.findMany({
        where: { order: { userId } },
        select: {
          id: true,
          orderId: true,
          reason: true,
          description: true,
          attachments: true,
          resolution: true,
          status: true,
          items: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.retailRefund.findMany({
        where: { order: { userId } },
        select: {
          id: true,
          orderId: true,
          returnId: true,
          amountCents: true,
          reason: true,
          status: true,
          providerReference: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.purchaseOrderReturn.findMany({
        where: { requestedById: userId },
        select: {
          id: true,
          orderId: true,
          reason: true,
          status: true,
          decisionReason: true,
          carrier: true,
          trackingNumber: true,
          receivedAt: true,
          items: {
            select: {
              orderItemId: true,
              quantity: true,
              receivedQuantity: true,
              restockQuantity: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.purchaseOrderRefund.findMany({
        where: { requestedById: userId },
        select: {
          id: true,
          orderId: true,
          returnId: true,
          amountCents: true,
          currency: true,
          reason: true,
          status: true,
          decisionReason: true,
          providerReference: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    await this.prisma.accountPrivacyRequest.create({
      data: {
        userId,
        type: 'EXPORT',
        status: 'COMPLETED',
        reason: 'Self-service personal data export',
        resolution: 'Delivered immediately as an authenticated download.',
        resolvedAt: new Date(),
      },
    });
    await this.record(actor, 'account.data.exported', actor.sub);
    return {
      exportedAt: new Date().toISOString(),
      newsletter,
      dealerTerms,
      afterSales: {
        retailReturns,
        retailRefunds,
        dealerReturns,
        dealerRefunds,
      },
      contacts,
      profile,
      addresses,
      favorites,
      orders,
      applications,
      privacyRequests,
      sessions,
      applicationDraft,
      procurementCart,
    };
  }
  async requestDeletion(actor: JwtPayload, dto: PrivacyRequestDto) {
    const userId = this.customer(actor);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await verifyPassword(dto.password, user.passwordHash)))
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'current password incorrect',
        400,
      );
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const existing = await tx.accountPrivacyRequest.findFirst({
        where: { userId, type: 'DELETE', status: 'OPEN' },
      });
      return (
        existing ??
        tx.accountPrivacyRequest.create({
          data: { userId, type: 'DELETE', reason: dto.reason },
        })
      );
    });
    await this.notifications?.enqueue({
      kind: 'account.deletion.requested',
      to: user.email,
      subject: 'Your account deletion request',
      text: `We received request ${result.id}. You can track its status in your account.`,
      dedupeKey: `account:${user.id}:privacy:${result.id}:requested`,
    });
    return result;
  }
  privacyRequests(actor: JwtPayload) {
    return this.prisma.accountPrivacyRequest.findMany({
      where: { userId: this.customer(actor) },
      orderBy: { createdAt: 'desc' },
    });
  }
  async listUsers(query: AccountAdminQueryDto) {
    const where = {
      ...(query.search
        ? {
            OR: [
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: profileSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
  async adminUser(id: string) {
    const profile = await this.prisma.user.findUnique({
      where: { id },
      select: profileSelect,
    });
    if (!profile) this.notFound();
    const [addresses, orders, subscription] = await Promise.all([
      this.prisma.accountAddress.findMany({
        where: { userId: id },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.order.findMany({
        where: { userId: id },
        select: {
          id: true,
          orderNo: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.newsletterSubscription.findUnique({
        where: { email: profile.email },
        select: {
          status: true,
          locale: true,
          consentVersion: true,
          updatedAt: true,
        },
      }),
    ]);
    return { profile, addresses, orders, subscription };
  }
  async requestPasswordReset(actor: JwtPayload, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') this.notFound();
    if (!this.auth)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'Password reset service unavailable',
        503,
      );
    await this.auth.forgotPassword({ email: user.email });
    await this.record(actor, 'account.password.reset_requested', id);
    return { ok: true };
  }
  async setUserStatus(
    actor: JwtPayload,
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason: string,
  ) {
    if (reason.trim().length < 5)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'A meaningful account status reason is required',
        400,
      );
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) this.notFound();
    if (user.status === 'PENDING' || user.email.endsWith('@deleted.invalid'))
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'unverified or deleted accounts cannot be activated here',
        400,
      );
    const result = await this.prisma.user.update({
      where: { id },
      data: { status, authVersion: { increment: 1 } },
      select: profileSelect,
    });
    await this.record(actor, 'account.status.changed', id, { status, reason });
    if (status === 'SUSPENDED' && user.status !== status)
      await this.notifications?.enqueue({
        kind: 'account.disabled',
        to: user.email,
        subject: 'WEMOVE account access changed',
        text: 'Your account access was suspended. Contact support to request a review. Existing order obligations remain available through support.',
        dedupeKey: `account-disabled:${id}:${user.authVersion + 1}`,
      });
    return result;
  }
  listPrivacyRequests() {
    return this.prisma.accountPrivacyRequest.findMany({
      include: { user: { select: profileSelect } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  async resolvePrivacy(actor: JwtPayload, id: string, dto: ResolvePrivacyDto) {
    const recipient = await this.prisma.accountPrivacyRequest.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });
    const cleanupMediaIds: string[] = [];
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.accountPrivacyRequest.findUnique({
        where: { id },
      });
      if (!request) this.notFound();
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${request.userId} FOR UPDATE`;
      const changed = await tx.accountPrivacyRequest.updateMany({
        where: { id, status: 'OPEN' },
        data: { ...dto, handledBy: actor.sub, resolvedAt: new Date() },
      });
      if (!changed.count)
        throw new BizException(
          ERROR_CODES.CONFLICT,
          'request already handled',
          409,
        );
      if (dto.status === 'COMPLETED' && request.type === 'DELETE') {
        // Preserve commercial records for fulfillment/accounting; remove user-center personal data and all access.
        const openOrders = await tx.order.count({
          where: {
            userId: request.userId,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        });
        const membership = await tx.dealerMember.findFirst({
          where: { userId: request.userId, active: true },
        });
        if (openOrders || membership)
          throw new BizException(
            ERROR_CODES.CONFLICT,
            'close active orders and transfer/disable company membership before deletion',
            409,
          );
        const privateAccount = await tx.user.findUniqueOrThrow({
          where: { id: request.userId },
          select: { email: true },
        });
        await tx.newsletterSubscription.deleteMany({
          where: { email: privateAccount.email },
        });
        const contacts = await tx.contactMessage.findMany({
          where: { email: privateAccount.email },
          select: { attachments: true },
        });
        contacts.forEach((contact) =>
          cleanupMediaIds.push(...contact.attachments),
        );
        const unapproved = await tx.dealerApplication.findMany({
          where: { applicantId: request.userId, status: { not: 'APPROVED' } },
          select: { id: true, attachments: true },
        });
        for (const application of unapproved)
          for (const item of Array.isArray(application.attachments)
            ? application.attachments
            : []) {
            if (
              item &&
              typeof item === 'object' &&
              'mediaId' in item &&
              typeof item.mediaId === 'string'
            )
              cleanupMediaIds.push(item.mediaId);
          }
        await tx.dealerApplication.updateMany({
          where: { id: { in: unapproved.map((item) => item.id) } },
          data: {
            contactName: 'Deleted account',
            contactEmail: `${request.userId}@deleted.invalid`,
            phone: '',
            companyName: 'Removed by privacy request',
            legalRegNo: `deleted-${request.userId}`,
            status: 'REJECTED',
            remark:
              'Application withdrawn following an approved account privacy request',
            attachments: [],
            claimTokenHash: null,
            claimExpiresAt: null,
            consentIp: null,
          },
        });
        await tx.contactMessage.updateMany({
          where: { email: privateAccount.email },
          data: {
            email: `${request.userId}@deleted.invalid`,
            name: 'Deleted account',
            subject: 'Removed by privacy request',
            content: 'Removed following an approved account privacy request',
            country: null,
            attachments: [],
            tags: [],
            history: [],
          },
        });
        await tx.user.update({
          where: { id: request.userId },
          data: {
            email: `${request.userId}@deleted.invalid`,
            name: 'Deleted account',
            displayName: null,
            country: null,
            phone: null,
            productUpdates: false,
            policiesIp: null,
            passwordHash: '',
            status: 'SUSPENDED',
            mfaEnabled: false,
            mfaSecret: null,
            marketingEmail: false,
            marketingSms: false,
            authVersion: { increment: 1 },
          },
        });
        await tx.accountAddress.deleteMany({
          where: { userId: request.userId },
        });
        await tx.accountFavorite.deleteMany({
          where: { userId: request.userId },
        });
        await tx.userToken.deleteMany({ where: { userId: request.userId } });
        await tx.dealerApplicationDraft.deleteMany({
          where: { userId: request.userId },
        });
        await tx.dealerProcurementCart.deleteMany({
          where: { userId: request.userId },
        });
        await tx.cart.deleteMany({ where: { userId: request.userId } });
        await tx.authenticationSession.updateMany({
          where: { ownerId: request.userId, ownerKind: 'customer' },
          data: { revokedAt: new Date(), ip: null, userAgent: null },
        });
      }
      return tx.accountPrivacyRequest.findUniqueOrThrow({ where: { id } });
    });
    await this.record(actor, 'account.privacy.resolved', id, {
      status: dto.status,
    });
    if (recipient)
      await this.notifications?.enqueue({
        kind: 'account.privacy.resolved',
        to: recipient.user.email,
        subject: 'Your WEMOVE privacy request has been reviewed',
        text: `Request ${id}: ${dto.status}. ${dto.resolution}`,
        dedupeKey: `account:${recipient.userId}:privacy:${id}:resolved`,
      });
    const mediaCleanup =
      cleanupMediaIds.length && this.media
        ? await this.media.deleteUnreferencedQualifications(
            [...new Set(cleanupMediaIds)],
            actor,
          )
        : null;
    return { ...result, mediaCleanup };
  }
  async resetCustomerMfa(actor: JwtPayload, id: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== 'ACTIVE') this.notFound();
    await this.prisma.user.update({
      where: { id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        authVersion: { increment: 1 },
      },
    });
    await this.record(actor, 'account.mfa.admin_reset', id, { reason });
    return { ok: true, enrollmentRequired: true };
  }
  async setupMfa(actor: JwtPayload, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: this.customer(actor) },
    });
    if (!(await verifyPassword(password, user.passwordHash)))
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'current password incorrect',
        400,
      );
    const setup = this.mfa.createSetup(user.email);
    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        mfaEnabled: false,
        passwordHash: user.passwordHash,
        authVersion: user.authVersion,
      },
      data: { mfaSecret: setup.secret },
    });
    if (!updated.count)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'MFA or password changed; reload security settings',
        409,
      );
    return setup;
  }
  async confirmMfa(actor: JwtPayload, code: string, disable = false) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: this.customer(actor) },
    });
    if (!user.mfaSecret)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'run MFA setup first',
        400,
      );
    await this.mfa.verifyWithLimit(`customer:${user.id}`, code, user.mfaSecret);
    if (disable) {
      const member = await this.prisma.dealerMember.findFirst({
        where: {
          userId: user.id,
          active: true,
          company: { status: 'APPROVED' },
        },
        include: { company: true },
      });
      if (
        (
          member?.company.purchaseSettings as
            { requireMfa?: boolean } | undefined
        )?.requireMfa
      )
        throw new BizException(
          ERROR_CODES.FORBIDDEN,
          'Your company requires MFA; contact your company administrator.',
          403,
        );
    }
    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        mfaSecret: user.mfaSecret,
        authVersion: user.authVersion,
      },
      data: {
        mfaEnabled: !disable,
        ...(disable ? { mfaSecret: null } : {}),
        authVersion: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'MFA settings changed; try again',
        409,
      );
    await this.record(
      actor,
      disable ? 'account.mfa.disabled' : 'account.mfa.enabled',
      actor.sub,
    );
    return { ok: true, signInRequired: true };
  }
  private notFound(): never {
    throw new BizException(ERROR_CODES.NOT_FOUND, 'record not found', 404);
  }
  private record(
    actor: JwtPayload,
    action: string,
    entityId: string,
    after?: { [key: string]: string | boolean },
  ) {
    return this.audit.record({
      actorKind: actor.kind === 'staff' ? 'STAFF' : 'CUSTOMER',
      actorStaffId: actor.kind === 'staff' ? actor.sub : null,
      actorCustomerId: actor.kind === 'customer' ? actor.sub : null,
      action,
      entityType: 'account',
      entityId,
      after,
    });
  }
}

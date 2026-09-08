import { acceptedDealerTerms } from '../account/dealer-terms.js';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { RedisService } from '../redis/redis.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './auth.service.js';
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = undefined;
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    if (!token)
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'missing bearer token',
        401,
      );
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret:
          process.env.JWT_ACCESS_SECRET ?? 'dev_only_change_me_wemove_access',
      });
    } catch {
      throw new BizException(
        ERROR_CODES.TOKEN_EXPIRED,
        'token expired or invalid',
        401,
      );
    }
    if (!payload.jti || !['staff', 'customer'].includes(payload.kind))
      this.revoked();
    const session = await this.prisma.authenticationSession.findUnique({
      where: { id: payload.jti },
    });
    if (
      !session ||
      session.ownerId !== payload.sub ||
      session.ownerKind !== payload.kind ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    )
      this.revoked();
    if (
      payload.kind === 'staff' &&
      /^(?:\/api\/v1)?\/dealer(?:\/|$)/.test(
        (req.originalUrl ?? req.url).split('?')[0],
      )
    )
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'Staff must use the permission-protected admin dealer endpoints',
        403,
      );
    if (payload.kind === 'staff') {
      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
        include: {
          roles: {
            include: {
              role: {
                include: { permissions: { include: { permission: true } } },
              },
            },
          },
        },
      });
      if (
        !staff ||
        staff.status !== 'ACTIVE' ||
        staff.authVersion !== session.authVersion ||
        !staff.mfaEnabled ||
        !session.mfaVerified
      )
        this.revoked();
      const permissions = new Set(
        staff.roles.flatMap((r) =>
          r.role.permissions.map((p) => p.permission.code),
        ),
      );
      const overrides = staff.permissionOverrides as {
        grant?: string[];
        deny?: string[];
      };
      for (const p of overrides.grant ?? []) permissions.add(p);
      for (const p of overrides.deny ?? []) permissions.delete(p);
      payload = {
        ...payload,
        name: staff.name,
        email: staff.email,
        roles: staff.roles.map((r) => r.role.code),
        permissions: [...permissions],
        authVersion: staff.authVersion,
      };
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (
        !user ||
        user.status !== 'ACTIVE' ||
        user.authVersion !== session.authVersion ||
        (user.mfaEnabled && !session.mfaVerified)
      )
        this.revoked();
      const member = await this.prisma.dealerMember.findFirst({
        where: {
          userId: user.id,
          active: true,
          company: { status: 'APPROVED' },
        },
        include: { company: { select: { purchaseSettings: true } } },
        orderBy: { createdAt: 'asc' },
      });
      const path = (req.originalUrl ?? req.url).split('?')[0];
      const onboarding =
        /\/dealer\/(?:terms|applications|application-draft|invitations)(?:\/|$)/.test(
          path,
        );
      const policy = member?.company.purchaseSettings as
        { requireMfa?: boolean } | undefined;
      if (
        policy?.requireMfa &&
        (!user.mfaEnabled || !session.mfaVerified) &&
        !onboarding &&
        /\/(?:dealer|media)(?:\/|$)/.test(path)
      )
        throw new BizException(
          ERROR_CODES.MFA_REQUIRED,
          'Your company requires MFA. Enroll through account security before accessing dealer services.',
          403,
        );
      if (
        member &&
        !acceptedDealerTerms(member) &&
        !onboarding &&
        /\/dealer(?:\/|$)/.test(path)
      )
        throw new BizException(
          ERROR_CODES.DEALER_TERMS_REQUIRED,
          'Accept the current dealer terms at /dealer/terms before using dealer services.',
          403,
        );
      // An approved member remains a registered customer until dealer terms are accepted.
      // Withhold the company boundary from media authorization so dealer-only files stay private.
      const mediaMember =
        /\/media(?:\/|$)/.test(path) && member && !acceptedDealerTerms(member)
          ? null
          : member;
      payload = {
        ...payload,
        name: user.name,
        email: user.email,
        companyId: mediaMember?.companyId ?? null,
        companyRole: mediaMember?.role ?? null,
        authVersion: user.authVersion,
      };
    }
    if (Date.now() - session.lastSeenAt.getTime() > 60_000)
      await this.prisma.authenticationSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    req.user = payload;
    return true;
  }
  private revoked(): never {
    throw new BizException(
      ERROR_CODES.TOKEN_EXPIRED,
      'session revoked or account no longer authorized',
      401,
    );
  }
}
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      context.switchToHttp().getRequest<AuthenticatedRequest>().user =
        undefined;
    }
    return true;
  }
}

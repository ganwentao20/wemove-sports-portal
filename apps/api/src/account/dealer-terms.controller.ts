import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { Equals, IsBoolean, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import {
  DEALER_TERMS,
  DEALER_TERMS_VERSION,
  acceptedDealerTerms,
} from './dealer-terms.js';
class AcceptDealerTermsDto {
  @IsBoolean() @Equals(true) accepted!: boolean;
  @IsString() @MaxLength(80) version!: string;
}
@Controller('dealer/terms')
@UseGuards(JwtAuthGuard)
export class DealerTermsController {
  constructor(private readonly prisma: PrismaService) {}
  private member(actor: JwtPayload) {
    if (actor.kind !== 'customer' || !actor.companyId)
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'An active approved dealer membership is required',
        403,
      );
    return this.prisma.dealerMember.findFirstOrThrow({
      where: {
        userId: actor.sub,
        companyId: actor.companyId,
        active: true,
        company: { status: 'APPROVED' },
      },
      include: {
        company: { select: { companyName: true, purchaseSettings: true } },
        user: { select: { mfaEnabled: true } },
      },
    });
  }
  @Get() async read(@CurrentUser() actor: JwtPayload) {
    const member = await this.member(actor);
    return {
      ...DEALER_TERMS,
      companyId: member.companyId,
      companyName: member.company.companyName,
      accepted: acceptedDealerTerms(member),
      acceptedAt: member.termsAcceptedAt,
      mfaRequired: !!(
        member.company.purchaseSettings as { requireMfa?: boolean }
      ).requireMfa,
      mfaEnabled: member.user.mfaEnabled,
    };
  }
  @Post() async accept(
    @CurrentUser() actor: JwtPayload,
    @Body() input: AcceptDealerTermsDto,
    @Ip() ip?: string,
  ) {
    if (input.version !== DEALER_TERMS_VERSION)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'Terms changed; reload and review the current version',
        409,
      );
    const member = await this.member(actor);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM "DealerMember" WHERE "companyId"=${member.companyId} AND "userId"=${actor.sub} FOR UPDATE`;
      const current = await tx.dealerMember.findFirst({
        where: {
          companyId: member.companyId,
          userId: actor.sub,
          active: true,
          company: { status: 'APPROVED' },
        },
      });
      if (!current)
        throw new BizException(
          ERROR_CODES.FORBIDDEN,
          'Dealer membership is no longer active',
          403,
        );
      if (acceptedDealerTerms(current))
        return {
          accepted: true,
          version: DEALER_TERMS_VERSION,
          acceptedAt: current.termsAcceptedAt,
        };
      const saved = await tx.dealerMember.update({
        where: {
          companyId_userId: { companyId: member.companyId, userId: actor.sub },
        },
        data: {
          termsVersion: DEALER_TERMS_VERSION,
          termsAcceptedAt: new Date(),
          termsAcceptedIp: ip ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorKind: 'CUSTOMER',
          actorCustomerId: actor.sub,
          action: 'dealer.terms.accepted',
          entityType: 'DealerMember',
          entityId: `${member.companyId}:${actor.sub}`,
          ip: ip ?? null,
          after: {
            version: DEALER_TERMS_VERSION,
            companyId: member.companyId,
            acceptedAt: saved.termsAcceptedAt?.toISOString(),
          },
        },
      });
      return {
        accepted: true,
        version: DEALER_TERMS_VERSION,
        acceptedAt: saved.termsAcceptedAt,
      };
    });
  }
}

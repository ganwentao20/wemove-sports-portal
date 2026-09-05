import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';

const APPLICATION_RATE_LIMIT = { max: 5, windowSec: 60 } as const;

/** MB：经销商申请服务。申请归属按联系邮箱或已关联企业 companyId 判定。 */
@Injectable()
export class DealerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createApplication(dto: CreateDealerApplicationDto, ip?: string) {
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
    const duplicate = await this.prisma.dealerApplication.findFirst({
      where: {
        contactEmail,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'dealer application already pending',
        409,
      );
    }

    const attachments: Prisma.InputJsonValue = dto.attachments.map(
      (attachment) => ({
        fileName: attachment.fileName.trim(),
        key: attachment.key.trim(),
        ...(attachment.url ? { url: attachment.url } : {}),
        visibility: 'PRIVATE',
      }),
    );
    const application = await this.prisma.dealerApplication.create({
      data: {
        contactName: dto.contactName.trim(),
        contactEmail,
        phone: dto.phone.trim(),
        country: dto.country.trim(),
        businessType: dto.businessType.trim(),
        attachments,
      },
      select: this.applicationSelect(),
    });
    return application;
  }

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

    const ownsByEmail =
      application.contactEmail.toLowerCase() ===
      currentUser.email.toLowerCase();
    const ownsByCompany = Boolean(
      currentUser.companyId && application.companyId === currentUser.companyId,
    );
    if (!ownsByEmail && !ownsByCompany) {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'dealer application belongs to another account',
        403,
      );
    }
    return application;
  }

  private applicationSelect() {
    return {
      id: true,
      companyId: true,
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

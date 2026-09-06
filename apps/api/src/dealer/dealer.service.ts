import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';

const APPLICATION_RATE_LIMIT = { max: 5, windowSec: 60 } as const;

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
  ) {}

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
      const duplicateByApplicant = await this.prisma.dealerApplication.findFirst({
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

    const attachments: Prisma.InputJsonValue = dto.attachments.map((attachment) => ({
      fileName: attachment.fileName.trim(),
      key: attachment.key.trim(),
      ...(attachment.url ? { url: attachment.url } : {}),
      visibility: 'PRIVATE',
    }));

    const application = await this.prisma.dealerApplication.create({
      data: {
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

  private applicationSelect() {
    return {
      id: true,
      companyId: true,
      applicantId: true,
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

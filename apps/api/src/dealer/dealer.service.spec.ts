import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { DealerService } from './dealer.service.js';

/** 归属按 applicantId（提交人外键）/ companyId（企业），邮箱字符串不再参与判定 */
const application = {
  id: 'app-owner',
  companyId: 'company-a',
  applicantId: 'user-a',
  contactName: 'Buyer',
  contactEmail: 'owner@example.com',
  phone: '13800000000',
  country: 'CN',
  businessType: 'Retailer',
  attachments: [],
  status: 'SUBMITTED',
  remark: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

function setup(found: typeof application | null = application) {
  const prisma = {
    dealerApplication: {
      findUnique: vi.fn().mockResolvedValue(found),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(application),
    },
  } as unknown as PrismaService;
  const redis = {
    incrWithTtl: vi.fn().mockResolvedValue(1),
  } as unknown as RedisService;
  return { service: new DealerService(prisma, redis), prisma, redis };
}

const customer = (partial: Partial<{ sub: string; email: string; companyId: string | null }>) => ({
  sub: 'user-a',
  kind: 'customer' as const,
  email: 'owner@example.com',
  name: 'Owner',
  companyId: null,
  ...partial,
});

describe('DealerService', () => {
  it('normalizes email and forces attachment visibility to PRIVATE', async () => {
    const { service, prisma } = setup();
    await service.createApplication(
      {
        contactName: ' Buyer ',
        contactEmail: 'OWNER@EXAMPLE.COM',
        phone: '13800000000',
        country: 'CN',
        businessType: 'Retailer',
        attachments: [{ fileName: ' license.pdf ', key: 'private/license.pdf' }],
      },
      '127.0.0.1',
    );
    expect(prisma.dealerApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactEmail: 'owner@example.com',
          applicantId: null, // 未登录提交不绑定
          attachments: [
            { fileName: 'license.pdf', key: 'private/license.pdf', visibility: 'PRIVATE' },
          ],
        }),
      }),
    );
  });

  it('登录用户提交时绑定 applicantId（仅 customer）', async () => {
    const { service, prisma } = setup();
    await service.createApplication(
      {
        contactName: 'Buyer',
        contactEmail: 'someone@example.com',
        phone: '13800000000',
        country: 'CN',
        businessType: 'Retailer',
        attachments: [],
      },
      undefined,
      customer({ email: 'someone@example.com' }),
    );
    expect(prisma.dealerApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ applicantId: 'user-a' }) }),
    );
  });

  it('允许提交人本人（applicantId 匹配）读取申请', async () => {
    const { service } = setup();
    await expect(
      service.findApplication('app-owner', customer({ sub: 'user-a' })),
    ).resolves.toMatchObject({ id: 'app-owner' });
  });

  it('允许已关联企业成员读取申请（companyId 匹配）', async () => {
    const { service } = setup();
    await expect(
      service.findApplication('app-owner', customer({ sub: 'user-b', companyId: 'company-a' })),
    ).resolves.toMatchObject({ companyId: 'company-a' });
  });

  it('回归：邮箱相同但非提交人且无企业关联 → 403（防伪造邮箱越权）', async () => {
    const { service } = setup();
    await expect(
      service.findApplication('app-owner', customer({ sub: 'attacker', companyId: null })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('拒绝其他用户（不同 applicantId/companyId）→ 403', async () => {
    const { service } = setup();
    await expect(
      service.findApplication('app-owner', customer({ sub: 'user-x', companyId: 'company-x' })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('返回 404：申请不存在', async () => {
    const { service } = setup(null);
    await expect(
      service.findApplication('missing', customer({ sub: 'user-a' })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('超过提交频率限制 → 429', async () => {
    const { service, redis } = setup();
    vi.mocked(redis.incrWithTtl).mockResolvedValue(6);
    await expect(
      service.createApplication({
        contactName: 'Buyer',
        contactEmail: 'owner@example.com',
        phone: '13800000000',
        country: 'CN',
        businessType: 'Retailer',
        attachments: [],
      }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

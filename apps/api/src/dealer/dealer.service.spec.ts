import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { PricingEngine } from '../pricing/pricing.module.js';
import type { ApplicationStatus } from '@prisma/client';
import { DealerService } from './dealer.service.js';

/** 归属按 applicantId（提交人外键）/ companyId（企业），邮箱字符串不再参与判定 */
interface ApplicationFixture {
  id: string;
  companyId: string | null;
  applicantId: string | null;
  companyName: string;
  legalRegNo: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  country: string;
  businessType: string;
  attachments: never[];
  status: ApplicationStatus;
  remark: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const application: ApplicationFixture = {
  id: 'app-owner',
  companyId: 'company-a',
  applicantId: 'user-a',
  companyName: 'WEMOVE Dealer Ltd.',
  legalRegNo: 'CN-DEMO-001',
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
};

function setup(found: ApplicationFixture | null = application) {
  const prismaMock = {
    dealerApplication: {
      findUnique: vi.fn().mockResolvedValue(found),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(found ? [found] : []),
      create: vi.fn().mockResolvedValue(application),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...application, ...data }),
        ),
    },
    dealerCompany: {
      findFirst: vi.fn().mockResolvedValue({ id: 'company-a', tierId: 'gold' }),
      create: vi.fn().mockResolvedValue({ id: 'company-new' }),
      update: vi.fn().mockResolvedValue({ id: 'company-a' }),
    },
    dealerMember: { upsert: vi.fn().mockResolvedValue({}) },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    pricingRule: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  const prisma = prismaMock as unknown as PrismaService;
  const redis = {
    incrWithTtl: vi.fn().mockResolvedValue(1),
  } as unknown as RedisService;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  return {
    service: new DealerService(prisma, redis, audit, new PricingEngine()),
    prisma,
    redis,
    audit,
  };
}

const customer = (
  partial: Partial<{ sub: string; email: string; companyId: string | null }>,
) => ({
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
        companyName: ' WEMOVE Dealer Ltd. ',
        legalRegNo: ' CN-DEMO-001 ',
        contactName: ' Buyer ',
        contactEmail: 'OWNER@EXAMPLE.COM',
        phone: '13800000000',
        country: 'CN',
        businessType: 'Retailer',
        attachments: [
          { fileName: ' license.pdf ', key: 'private/license.pdf' },
        ],
      },
      '127.0.0.1',
    );
    expect(prisma.dealerApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyName: 'WEMOVE Dealer Ltd.',
          legalRegNo: 'CN-DEMO-001',
          contactEmail: 'owner@example.com',
          applicantId: null, // 未登录提交不绑定
          attachments: [
            {
              fileName: 'license.pdf',
              key: 'private/license.pdf',
              visibility: 'PRIVATE',
            },
          ],
        }),
      }),
    );
  });

  it('登录用户提交时绑定 applicantId（仅 customer）', async () => {
    const { service, prisma } = setup();
    await service.createApplication(
      {
        companyName: 'WEMOVE Dealer Ltd.',
        legalRegNo: 'CN-DEMO-002',
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
      expect.objectContaining({
        data: expect.objectContaining({ applicantId: 'user-a' }),
      }),
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
      service.findApplication(
        'app-owner',
        customer({ sub: 'user-b', companyId: 'company-a' }),
      ),
    ).resolves.toMatchObject({ companyId: 'company-a' });
  });

  it('回归：邮箱相同但非提交人且无企业关联 → 403（防伪造邮箱越权）', async () => {
    const { service } = setup();
    await expect(
      service.findApplication(
        'app-owner',
        customer({ sub: 'attacker', companyId: null }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('拒绝其他用户（不同 applicantId/companyId）→ 403', async () => {
    const { service } = setup();
    await expect(
      service.findApplication(
        'app-owner',
        customer({ sub: 'user-x', companyId: 'company-x' }),
      ),
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
        companyName: 'WEMOVE Dealer Ltd.',
        legalRegNo: 'CN-DEMO-001',
        contactName: 'Buyer',
        contactEmail: 'owner@example.com',
        phone: '13800000000',
        country: 'CN',
        businessType: 'Retailer',
        attachments: [],
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('管理员可要求补件并写入审核审计', async () => {
    const { service, prisma, audit } = setup();
    await expect(
      service.reviewApplication(
        'app-owner',
        {
          status: 'MORE_INFO_REQUIRED',
          remark: 'Please provide registration proof.',
        },
        {
          sub: 'staff-1',
          kind: 'staff',
          email: 'admin@example.com',
          name: 'Admin',
        },
      ),
    ).resolves.toMatchObject({ status: 'MORE_INFO_REQUIRED' });
    expect(prisma.dealerApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewedBy: 'staff-1' }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'dealer.application.review',
        actorStaffId: 'staff-1',
      }),
    );
  });

  it('拒绝从审核终态回退', async () => {
    const { service } = setup({ ...application, status: 'APPROVED' });
    await expect(
      service.reviewApplication(
        'app-owner',
        { status: 'UNDER_REVIEW' },
        {
          sub: 'staff-1',
          kind: 'staff',
          email: 'admin@example.com',
          name: 'Admin',
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('审核通过时原子创建企业、绑定申请人 OWNER 并回填 companyId', async () => {
    const pending = { ...application, companyId: null };
    const { service, prisma } = setup(pending);
    await expect(
      service.reviewApplication(
        pending.id,
        { status: 'APPROVED' },
        {
          sub: 'staff-1',
          kind: 'staff',
          email: 'admin@example.com',
          name: 'Admin',
        },
      ),
    ).resolves.toMatchObject({ status: 'APPROVED', companyId: 'company-new' });
    expect(prisma.dealerCompany.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyName: 'WEMOVE Dealer Ltd.',
          legalRegNo: 'CN-DEMO-001',
          status: 'APPROVED',
        }),
      }),
    );
    expect(prisma.dealerMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          companyId: 'company-new',
          userId: 'user-a',
          role: 'OWNER',
        }),
      }),
    );
  });

  it('匿名且未绑定企业的申请不能直接批准', async () => {
    const pending = { ...application, companyId: null, applicantId: null };
    const { service, prisma } = setup(pending);
    await expect(
      service.reviewApplication(
        pending.id,
        { status: 'APPROVED' },
        {
          sub: 'staff-1',
          kind: 'staff',
          email: 'admin@example.com',
          name: 'Admin',
        },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.dealerCompany.create).not.toHaveBeenCalled();
  });

  it('拒绝无企业身份的零售用户查看经销商价', async () => {
    const { service } = setup();
    await expect(
      service.listDealerCatalog(1, customer({ companyId: null })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('按企业价优先返回目录且不泄漏默认底价字段', async () => {
    const { service, prisma } = setup();
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 'product-1',
        slug: 'ball',
        name: 'Ball',
        summary: null,
        gallery: [],
        variants: [
          {
            id: 'variant-1',
            sku: 'BALL-1',
            name: null,
            attrs: {},
            b2bDefaultPriceCents: 3000,
          },
        ],
      },
    ] as never);
    vi.mocked(prisma.pricingRule.findMany).mockResolvedValue([
      {
        id: 'company-rule',
        variantId: 'variant-1',
        scope: 'COMPANY_SPECIFIC',
        priority: 0,
        companyId: 'company-a',
        bookId: null,
        tierId: null,
        priceCents: 2500,
        minQty: 1,
      },
    ] as never);

    const result = await service.listDealerCatalog(
      5,
      customer({ companyId: 'company-a' }),
    );
    expect(result[0]?.variants[0]).toMatchObject({
      sku: 'BALL-1',
      quantity: 5,
      price: { priceCents: 2500, source: 'COMPANY_SPECIFIC' },
    });
    expect(result[0]?.variants[0]).not.toHaveProperty('b2bDefaultPriceCents');
  });
});

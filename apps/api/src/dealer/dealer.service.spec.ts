import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { DealerService } from './dealer.service.js';

const application = {
  id: 'app-owner',
  companyId: 'company-a',
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
        attachments: [
          { fileName: ' license.pdf ', key: 'private/license.pdf' },
        ],
      },
      '127.0.0.1',
    );
    expect(prisma.dealerApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactEmail: 'owner@example.com',
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

  it('allows the applicant email to read its own application', async () => {
    const { service } = setup();
    await expect(
      service.findApplication('app-owner', {
        sub: 'user-a',
        kind: 'customer',
        email: 'owner@example.com',
        name: 'Owner',
        companyId: null,
      }),
    ).resolves.toMatchObject({ id: 'app-owner' });
  });

  it('allows a member of the linked company to read the application', async () => {
    const { service } = setup();
    await expect(
      service.findApplication('app-owner', {
        sub: 'user-b',
        kind: 'customer',
        email: 'member@example.com',
        name: 'Member',
        companyId: 'company-a',
      }),
    ).resolves.toMatchObject({ companyId: 'company-a' });
  });

  it('rejects another customer with 403', async () => {
    const { service } = setup();
    await expect(
      service.findApplication('app-owner', {
        sub: 'user-x',
        kind: 'customer',
        email: 'other@example.com',
        name: 'Other',
        companyId: 'company-x',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns 404 for a missing application', async () => {
    const { service } = setup(null);
    await expect(
      service.findApplication('missing', {
        sub: 'user-a',
        kind: 'customer',
        email: 'owner@example.com',
        name: 'Owner',
        companyId: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 429 after the Redis rate-limit placeholder is exceeded', async () => {
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

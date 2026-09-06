import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { PricingAdminService } from './pricing-admin.service.js';

const actor = {
  sub: 'staff-a',
  kind: 'staff' as const,
  email: 'admin@example.com',
  name: 'Admin',
};

const existingRule = {
  id: 'rule-a',
  variantId: 'variant-a',
  scope: 'COMPANY_SPECIFIC' as const,
  priority: 0,
  companyId: 'company-a',
  bookId: null,
  tierId: null,
  priceCents: 1500,
  minQty: 1,
  active: true,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup() {
  const prismaMock = {
    productVariant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'variant-a' }),
    },
    dealerCompany: {
      findUnique: vi.fn().mockResolvedValue({ id: 'company-a' }),
    },
    priceBook: { findUnique: vi.fn().mockResolvedValue({ id: 'book-a' }) },
    dealerTier: { findUnique: vi.fn().mockResolvedValue({ id: 'tier-a' }) },
    pricingRule: {
      findUnique: vi.fn().mockResolvedValue(existingRule),
      create: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'rule-new', ...data }),
        ),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...existingRule, ...data }),
        ),
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  return {
    service: new PricingAdminService(
      prismaMock as unknown as PrismaService,
      audit as unknown as AuditService,
    ),
    prisma: prismaMock,
  };
}

describe('PricingAdminService', () => {
  it('validates the target variant before creating a rule', async () => {
    const { service, prisma } = setup();
    prisma.productVariant.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          variantId: 'missing',
          scope: 'B2B_DEFAULT',
          priceCents: 1000,
          priority: 0,
          minQty: 1,
          active: true,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.pricingRule.create).not.toHaveBeenCalled();
  });

  it('rejects references that do not belong to the selected scope', async () => {
    const { service, prisma } = setup();

    await expect(
      service.create(
        {
          variantId: 'variant-a',
          scope: 'COMPANY_SPECIFIC',
          companyId: 'company-a',
          bookId: 'book-a',
          priceCents: 1000,
          priority: 0,
          minQty: 1,
          active: true,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.pricingRule.create).not.toHaveBeenCalled();
  });

  it('creates a canonical company rule with unrelated references cleared', async () => {
    const { service, prisma } = setup();

    await service.create(
      {
        variantId: 'variant-a',
        scope: 'COMPANY_SPECIFIC',
        companyId: 'company-a',
        priceCents: 1000,
        priority: 0,
        minQty: 1,
        active: true,
      },
      actor,
    );

    expect(prisma.pricingRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-a',
        bookId: null,
        tierId: null,
      }),
    });
  });

  it('clears the previous company reference when changing to a price-table scope', async () => {
    const { service, prisma } = setup();

    await service.update(
      'rule-a',
      { scope: 'PRICE_TABLE', bookId: 'book-a' },
      actor,
    );

    expect(prisma.pricingRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-a' },
      data: expect.objectContaining({
        scope: 'PRICE_TABLE',
        companyId: null,
        bookId: 'book-a',
        tierId: null,
      }),
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { DealerService } from './dealer.service.js';

function service(status = 'PUBLISHED') {
  const company = {
    id: 'public-dealer',
    companyName: 'Original Company',
    country: 'US',
    catalogPolicy: {},
    profile: {
      directoryPublished: {
        publicListing: true,
        publicDetail: true,
        displayName: 'Editorial store name',
        publicAddress: '12 Original Street',
        publicDescription: 'A published store description',
      },
    },
  };
  const prisma = {
    siteSetting: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ value: { languages: ['en', 'zh'] } }),
    },
    dealerCompany: { findMany: vi.fn().mockResolvedValue([company]) },
    productCategory: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            id: 'bowling',
            name: 'Kids Bowling',
            seo: {
              translations: {
                zh: { status, name: '儿童保龄球' },
                fr: { status: 'IN_PROGRESS', name: 'Private draft' },
              },
            },
          },
        ]),
    },
  };
  return new DealerService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );
}
describe('public dealer directory category locale', () => {
  it('uses published Chinese names while preserving business content and category ids', async () => {
    const result = await service().directory(undefined, 'zh');
    expect(result).toMatchObject([
      {
        companyName: 'Editorial store name',
        address: '12 Original Street',
        description: 'A published store description',
        categories: [{ id: 'bowling', name: '儿童保龄球' }],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('translations');
    expect(JSON.stringify(result)).not.toContain('Private draft');
  });
  it('keeps English for unpublished translations and unsupported locales', async () => {
    for (const [status, locale] of [
      ['IN_PROGRESS', 'zh'],
      ['PUBLISHED', 'fr'],
      ['PUBLISHED', 'en'],
    ]) {
      const result = await service(status).directory('public-dealer', locale);
      expect(result).toMatchObject({
        categories: [{ id: 'bowling', name: 'Kids Bowling' }],
      });
    }
  });
});

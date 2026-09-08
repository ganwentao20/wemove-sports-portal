import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';
import { CartService } from '../cart/cart.service.js';
import { AccountService } from '../account/account.service.js';
import {
  localizedCategory,
  localizedVariant,
  productDisplayLabels,
} from './product-locales.js';

function product(id = 'one', status = 'PUBLISHED') {
  return {
    id,
    slug: id,
    name: `English ${id}`,
    summary: 'Public English summary',
    description: null,
    ageGuidance: null,
    ageMin: 3,
    ageMax: 12,
    scenes: ['Outdoor'],
    skills: ['Balance'],
    tags: ['Featured'],
    gallery: [],
    seo: {},
    playGuide: null,
    productFaq: [],
    relatedSlugs: [],
    associations: [],
    resources: [],
    createdAt: new Date(),
    category: {
      slug: 'category',
      name: 'English category',
      description: null,
      seo: { translations: { zh: { status: 'PUBLISHED', name: '中文分类' } } },
    },
    specifications: {
      translations: {
        zh: {
          status,
          name: '平衡玩具',
          summary: '中文介绍',
          skillLabels: { Balance: '平衡' },
          sceneLabels: { Outdoor: '户外' },
          tagLabels: { Featured: '精选' },
          variants: {
            DEMO: {
              name: '中文款式',
              attrs: { color: { label: '颜色', value: '红色' } },
            },
          },
        },
      },
    },
    variants: [
      {
        id: 'variant',
        sku: 'DEMO',
        name: 'English variant',
        attrs: { color: 'Red', gallery: [{ url: '/image.png', alt: 'Image' }] },
        msrpCents: 1000,
        salePriceCents: 800,
        marketPrices: {},
        weightGrams: 100,
        availabilityPolicy: 'IN_STOCK_ONLY',
        backorderLimit: 0,
        leadTimeDays: null,
        stock: { available: 10, lowThreshold: 5, syncError: null },
        marketInventory: [],
      },
    ],
  };
}
function service(rows: ReturnType<typeof product>[]) {
  return new CatalogService({
    retailMarket: { findUnique: vi.fn().mockResolvedValue(null) },
    siteSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    product: {
      findMany: vi.fn().mockResolvedValue(rows),
      findFirst: vi.fn().mockResolvedValue(rows[0]),
    },
  } as any);
}
describe('catalog language contract', () => {
  it.each(['PUBLISHED', 'DRAFT'])('localizes live cart and favorites only from %s content without changing prices or exposing drafts', async (status) => {
    const row = product('one', status);
    const variant = { ...row.variants[0], product: row, status: true };
    const prisma = {
      cart: { upsert: vi.fn().mockResolvedValue({ id: 'cart', items: [{ id: 'line', variantId: variant.id, quantity: 2, unitPriceCents: 800, variant }] }) },
      accountFavorite: { findMany: vi.fn().mockResolvedValue([{ id: 'favorite', productId: row.id }]) },
      product: { findMany: vi.fn().mockResolvedValue([row]) },
    };
    const actor = { kind: 'customer', sub: 'customer' } as any;
    const cart = await new CartService(prisma as any).getMyCart(actor, 'zh');
    expect(cart.items[0]).toMatchObject({ name: status === 'PUBLISHED' ? '中文款式' : 'English variant', sku: 'DEMO', productSlug: 'one', unitPriceCents: 800, lineCents: 1600 });
    expect(cart.totalCents).toBe(1600);
    const favorites = await new AccountService(prisma as any, {} as any, {} as any).favorites(actor, 'zh');
    expect(favorites[0].product?.name).toBe(status === 'PUBLISHED' ? '平衡玩具' : 'English one');
    expect(favorites[0].product).not.toHaveProperty('specifications');
    expect(favorites[0].product).not.toHaveProperty('description');
    expect(row.name).toBe('English one');
  });
  it('finds published Chinese names and localized skill labels, retaining code filters', async () => {
    const catalog = service([product()]);
    for (const query of [
      { search: '平衡玩具' },
      { skill: '平衡' },
      { skill: 'Balance' },
      { scene: '户外' },
      { tag: '精选' },
      { search: 'demo' },
    ]) {
      const result = await catalog.list({
        ...query,
        locale: 'zh',
        page: 1,
        pageSize: 20,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        name: '平衡玩具',
        locale: 'zh',
        tags: ['Featured'],
        tagLabels: { Featured: '精选' },
      });
    }
  });
  it('does not match private draft names or labels, and keeps English fallback searchable', async () => {
    const catalog = service([product('draft', 'DRAFT')]);
    for (const query of [
      { search: '平衡玩具' },
      { skill: '平衡' },
      { scene: '户外' },
      { tag: '精选' },
    ]) {
      const result = await catalog.list({
        ...query,
        locale: 'zh',
        page: 1,
        pageSize: 20,
      });
      expect(result.items).toHaveLength(0);
    }
    expect(
      (
        await catalog.list({
          search: 'English',
          locale: 'zh',
          page: 1,
          pageSize: 20,
        })
      ).items[0].locale,
    ).toBe('en');
  });
  it('sorts names using the displayed locale, after translation', async () => {
    const first = product('zebra'),
      second = product('apple');
    first.specifications.translations.zh.name = '阿尔法';
    second.specifications.translations.zh.name = '自行车';
    const result = await service([second, first]).list({
      locale: 'zh',
      sort: 'name',
      page: 1,
      pageSize: 20,
    });
    expect(result.items.map((row) => row.id)).toEqual(['zebra', 'apple']);
  });
  it('localizes detail category and SKU options while retaining SKU and gallery data', async () => {
    const row = product();
    const result = await service([row]).findBySlug(row.slug, 'US', 'zh');
    expect(result.category?.name).toBe('中文分类');
    expect(result.variants[0]).toMatchObject({
      sku: 'DEMO',
      name: '中文款式',
      attrs: { 颜色: '红色', gallery: [{ url: '/image.png', alt: 'Image' }] },
    });
    expect(result.skills).toEqual(['Balance']);
    expect(result.skillLabels).toEqual({ Balance: '平衡' });
  });
  it('keeps category drafts private and only uses published SKU/label translations', () => {
    const row = product('draft', 'DRAFT');
    expect(localizedVariant(row.variants[0], row, 'zh')).toEqual(
      row.variants[0],
    );
    expect(productDisplayLabels(row, 'zh').skillLabels).toEqual({
      Balance: 'Balance',
    });
    const category = {
      name: 'Base',
      description: null,
      seo: {
        title: 'Base SEO',
        translations: { zh: { status: 'DRAFT', name: '草稿' } },
      },
    };
    expect(localizedCategory(category, 'zh')).toEqual({
      name: 'Base',
      description: null,
      seo: { title: 'Base SEO' },
    });
  });
});

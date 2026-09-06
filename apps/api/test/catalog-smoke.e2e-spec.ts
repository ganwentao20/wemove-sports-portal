import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/bootstrap-app.js';

/**
 * Catalog 主链路冒烟（组员 E）：
 * 分类 → 商品列表 → 详情 → 404，并校验公开响应不泄漏 B2B 底价字段。
 * 依赖 PostgreSQL/Redis（npm run db:up）；
 * 启用：$env:E2E_DB='1' 后运行 npm run test:e2e -w api（CI 已置 E2E_DB=1，自动纳入）。
 */
const runDb = process.env.E2E_DB === '1';

describe.skipIf(!runDb)('Catalog 主链路冒烟（需 DB）', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8).toLowerCase();
  const categoryCode = `E2_SMOKE_CAT_${suffix}`;
  const categorySlug = `e2e-smoke-cat-${suffix}`;
  const productSlug = `e2e-smoke-prod-${suffix}`;
  const sku = `E2-SMOKE-${suffix.toUpperCase()}`;
  let categoryId = '';
  let productId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await setupApp(app);
    await app.init();

    // 自己造测试数据（CI 里没有 seed，所以不能依赖演示数据）
    const category = await prisma.productCategory.create({
      data: {
        code: categoryCode,
        slug: categorySlug,
        name: 'E2 Smoke Category',
        active: true,
      },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        name: 'E2 Smoke Product',
        slug: productSlug,
        summary: 'created by E2 smoke test',
        ageGuidance: 'Ages 6+ with adult supervision.',
        resources: [{ label: 'Manual', url: '/manual.pdf', type: 'PDF' }],
        categoryId: category.id,
        status: 'ACTIVE',
      },
    });
    productId = product.id;
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku,
        name: 'Default',
        msrpCents: 1999,
        status: true,
        sortOrder: 0,
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    if (productId)
      await prisma.product
        .delete({ where: { id: productId } })
        .catch(() => undefined);
    if (categoryId)
      await prisma.productCategory
        .delete({ where: { id: categoryId } })
        .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('GET /api/v1/health/live → 统一成功响应体', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);
    expect(res.body.code).toBe(0);
  });

  it('GET /api/v1/categories → 包含自建分类', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);
    expect(res.body.code).toBe(0);
    const cats = res.body.data as Array<{ slug: string }>;
    expect(cats.map((c) => c.slug)).toContain(categorySlug);
  });

  it('GET /api/v1/products → 列表含自建商品卡片且无 B2B 字段', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products')
      .expect(200);
    expect(res.body.code).toBe(0);
    const cards = res.body.data.items as Array<Record<string, unknown>>;
    const found = cards.find((c) => c.slug === productSlug);
    if (!found) throw new Error('fixture product not found in list');
    expect(found).toHaveProperty('priceCents', 1999);
    expect(found).not.toHaveProperty('b2bDefaultPriceCents');
    expect(found).not.toHaveProperty('variants');
  });

  it('GET /api/v1/products/:slug → 详情含零售价且不泄漏内部价格字段', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/products/${productSlug}`)
      .expect(200);
    expect(res.body.code).toBe(0);
    const detail = res.body.data as {
      slug: string;
      ageGuidance: string;
      resources: Array<{ label: string; url: string }>;
      variants: Array<{ sku: string; price: { priceCents: number } }>;
    };
    expect(detail.slug).toBe(productSlug);
    expect(detail.ageGuidance).toBe('Ages 6+ with adult supervision.');
    expect(detail.resources).toEqual([
      { label: 'Manual', url: '/manual.pdf', type: 'PDF' },
    ]);
    const variant = detail.variants.find((v) => v.sku === sku);
    if (!variant) throw new Error('fixture variant not found in detail');
    expect(variant.price.priceCents).toBe(1999);
    expect(variant as object).not.toHaveProperty('msrpCents');
    expect(variant as object).not.toHaveProperty('salePriceCents');
    expect(variant as object).not.toHaveProperty('b2bDefaultPriceCents');
  });

  it('GET /api/v1/products/不存在的slug → 404 统一错误体', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products/no-such-e2e-slug')
      .expect(404);
    expect(res.body.code).toBe(40400);
  });
});

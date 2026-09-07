import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { generate, generateSecret } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { authenticatedFixture } from './auth-session.js';
import { DEALER_TERMS_VERSION } from '../src/account/dealer-terms.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Catalog category metadata, typed associations and reviewed bulk operations (DB)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID().slice(0, 8),
      secret = generateSecret();
    let app: INestApplication,
      staffId = '',
      token = '',
      categoryId = '',
      productId = '',
      variantId = '';
    const products: string[] = [];
    const api = (method: 'get' | 'post' | 'patch', path: string) =>
      request(app.getHttpServer())[method]('/api/v1' + path);
    const headers = async () => ({
      Authorization: 'Bearer ' + token,
      'x-mfa-code': await generate({ secret }),
    });
    const category = {
      code: 'CAT_' + suffix.toUpperCase(),
      slug: 'category-' + suffix,
      name: 'Category ' + suffix,
      description: 'Independent category description',
      coverImage: { url: '/images/category.jpg', alt: 'Category illustration' },
      seo: {
        title: 'Category SEO title',
        description: 'Category SEO summary',
        ogTitle: 'Category social title',
      },
      sortOrder: 12,
      active: true,
    };
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      await setupApp(app);
      await app.init();
      const role = await prisma.role.upsert({
        where: { code: 'SUPER_ADMIN' },
        create: { code: 'SUPER_ADMIN', name: 'Administrator' },
        update: {},
      });
      const staff = await prisma.staff.create({
        data: {
          name: 'Catalog final tester',
          email: 'catalog-final-' + suffix + '@example.test',
          passwordHash: 'unused',
          mfaEnabled: true,
          mfaSecret: secret,
          roles: { create: { roleId: role.id } },
        },
      });
      staffId = staff.id;
      token = await authenticatedFixture(
        prisma,
        app.get(JwtService),
        staff,
        'staff',
        true,
      );
      const p = await prisma.product.create({
        data: {
          name: 'Source ' + suffix,
          slug: 'catalog-final-' + suffix,
          status: 'ACTIVE',
          markets: ['US'],
          variants: {
            create: {
              sku: 'FINAL-' + suffix,
              msrpCents: 1000,
              stock: { create: { available: 10 } },
            },
          },
        },
        include: { variants: true },
      });
      productId = p.id;
      variantId = p.variants[0].id;
      products.push(p.id);
    });
    afterAll(async () => {
      await prisma.retailPriceHistory.deleteMany({ where: { variantId } });
      await prisma.product.deleteMany({ where: { id: { in: products } } });
      if (categoryId)
        await prisma.productCategory.delete({ where: { id: categoryId } });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: staffId },
      });
      if (staffId) await prisma.staff.delete({ where: { id: staffId } });
      await app?.close();
      await prisma.$disconnect();
    });
    it('edits live category description, cover and SEO, prevents hierarchy cycles and honors noindex/hidden state', async () => {
      const created = await api('post', '/admin/catalog/categories')
        .set(await headers())
        .send(category)
        .expect(201);
      categoryId = created.body.data.id;
      let listed = await api('get', '/categories?market=US').expect(200);
      expect(
        listed.body.data.find((c: { id: string }) => c.id === categoryId),
      ).toMatchObject({
        description: category.description,
        coverImage: category.coverImage,
        seo: category.seo,
      });
      let map = await api('get', '/site/sitemaps?locale=en&market=US').expect(
        200,
      );
      expect(
        map.body.data.items.some(
          (i: { path: string }) =>
            i.path === '/products?category=' + category.slug,
        ),
      ).toBe(true);
      await api('patch', '/admin/catalog/categories/' + categoryId)
        .set(await headers())
        .send({ ...category, parentId: categoryId })
        .expect(422);
      await api('patch', '/admin/catalog/categories/' + categoryId)
        .set(await headers())
        .send({
          ...category,
          coverImage: { url: 'javascript:alert(1)', alt: 'Invalid' },
        })
        .expect(422);
      await api('patch', '/admin/catalog/categories/' + categoryId)
        .set(await headers())
        .send({ ...category, seo: { noindex: true } })
        .expect(200);
      map = await api('get', '/site/sitemaps?locale=en&market=US').expect(200);
      expect(
        map.body.data.items.some(
          (i: { path: string }) =>
            i.path === '/products?category=' + category.slug,
        ),
      ).toBe(false);
      await api('patch', '/admin/catalog/categories/' + categoryId)
        .set(await headers())
        .send({ ...category, active: false, description: '', coverImage: null })
        .expect(200);
      listed = await api('get', '/categories').expect(200);
      expect(
        listed.body.data.some((c: { id: string }) => c.id === categoryId),
      ).toBe(false);
      await api('patch', '/admin/catalog/categories/' + categoryId)
        .set(await headers())
        .send(category)
        .expect(200);
    });
    it('previews category/tag changes, rejects bad references atomically, preserves omitted values and clears explicit blanks', async () => {
      const row = {
        slug: 'catalog-final-' + suffix,
        name: 'Source ' + suffix,
        sku: 'FINAL-' + suffix,
        msrpCents: 1000,
        available: 10,
        categorySlug: category.slug,
        tags: ['Featured', 'New'],
      };
      const preview = await api('post', '/admin/catalog/import')
        .set(await headers())
        .send({ rows: [row] })
        .expect(201);
      expect(preview.body.data).toMatchObject({
        errors: [],
        applied: false,
        updates: 1,
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .categoryId,
      ).toBeNull();
      await api('post', '/admin/catalog/import')
        .set(await headers())
        .send({ rows: [row], apply: true })
        .expect(201);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ categoryId, tags: ['Featured', 'New'] });
      const exported = await api('get', '/admin/catalog/export')
        .set(await headers())
        .expect(200);
      expect(exported.body.data.csv).toContain('categorySlug,tags');
      expect(exported.body.data.csv).toContain('Featured|New');
      await prisma.product.update({
        where: { id: productId },
        data: { name: '=HYPERLINK("https://example.test")' },
      });
      const safeExport = await api('get', '/admin/catalog/export')
        .set(await headers())
        .expect(200);
      expect(safeExport.body.data.csv).toContain("'=HYPERLINK");
      const { categorySlug: _, tags: __, ...unchanged } = row;
      await api('post', '/admin/catalog/import')
        .set(await headers())
        .send({ rows: [unchanged], apply: true })
        .expect(201);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ categoryId, tags: ['Featured', 'New'] });
      const bad = await api('post', '/admin/catalog/import')
        .set(await headers())
        .send({
          rows: [{ ...row, categorySlug: 'missing-' + suffix, msrpCents: 500 }],
          apply: true,
        })
        .expect(201);
      expect(bad.body.data.applied).toBe(false);
      expect(bad.body.data.errors.length).toBeGreaterThan(0);
      expect(
        (
          await prisma.productVariant.findUniqueOrThrow({
            where: { id: variantId },
          })
        ).msrpCents,
      ).toBe(1000);
      await api('post', '/admin/catalog/import')
        .set(await headers())
        .send({ rows: [{ ...row, categorySlug: '', tags: [] }], apply: true })
        .expect(201);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ categoryId: null, tags: [] });
    });
    it('normalizes imported SKUs for preview, existing lookup, atomic duplicate rejection and authorized quick order', async () => {
      const slug = 'canonical-import-' + suffix;
      const otherSlug = 'canonical-atomic-' + suffix;
      const canonicalSku = 'CSV-' + suffix.toUpperCase();
      const row = {
        slug,
        name: 'Canonical imported product',
        sku: '  ' + canonicalSku.toLowerCase() + '  ',
        msrpCents: 1200,
        available: 10,
        status: 'ACTIVE',
      };
      let dealerId = '',
        companyId = '';
      try {
        const preview = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({ rows: [row] })
          .expect(201);
        expect(preview.body.data).toMatchObject({
          applied: false,
          creates: 1,
          updates: 0,
          errors: [],
        });
        expect(await prisma.product.findUnique({ where: { slug } })).toBeNull();
        const applied = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({ rows: [row], apply: true })
          .expect(201);
        expect(applied.body.data).toMatchObject({
          applied: true,
          creates: 1,
          errors: [],
        });
        const imported = await prisma.productVariant.findUniqueOrThrow({
          where: { sku: canonicalSku },
          include: { product: true, stock: true },
        });
        expect(imported).toMatchObject({
          sku: canonicalSku,
          msrpCents: 1200,
          stock: { available: 10 },
        });
        const updatePreview = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({ rows: [{ ...row, msrpCents: 1400 }] })
          .expect(201);
        expect(updatePreview.body.data).toMatchObject({
          applied: false,
          creates: 0,
          updates: 1,
          errors: [],
        });
        const conflict = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({ rows: [{ ...row, slug: otherSlug }], apply: true })
          .expect(201);
        expect(conflict.body.data.applied).toBe(false);
        expect(conflict.body.data.errors).toContain(
          `SKU ${canonicalSku} already belongs to ${slug}`,
        );
        const duplicate = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({
            rows: [
              { ...row, sku: canonicalSku, msrpCents: 10, available: 1 },
              { ...row, msrpCents: 20, available: 2 },
              { ...row, slug: otherSlug, sku: canonicalSku + '-NEW' },
            ],
            apply: true,
          })
          .expect(201);
        expect(duplicate.body.data.applied).toBe(false);
        expect(duplicate.body.data.errors).toContain('Row 2: duplicate SKU');
        expect(
          await prisma.product.findUnique({ where: { slug: otherSlug } }),
        ).toBeNull();
        expect(
          await prisma.productVariant.findUniqueOrThrow({
            where: { id: imported.id },
            include: { stock: true },
          }),
        ).toMatchObject({ msrpCents: 1200, stock: { available: 10 } });
        const blank = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({
            rows: [{ ...row, slug: otherSlug, sku: '   ' }],
            apply: true,
          })
          .expect(201);
        expect(blank.body.data.applied).toBe(false);
        expect(blank.body.data.errors).toContain('Row 1: SKU is required');
        const updated = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({ rows: [{ ...row, msrpCents: 1400 }], apply: true })
          .expect(201);
        expect(updated.body.data).toMatchObject({
          applied: true,
          creates: 0,
          updates: 1,
        });
        expect(
          await prisma.productVariant.count({
            where: { productId: imported.productId },
          }),
        ).toBe(1);
        await prisma.productVariant.update({
          where: { id: imported.id },
          data: { sku: '  ' + canonicalSku.toLowerCase() + '  ' },
        });
        const legacy = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({ rows: [row], apply: true })
          .expect(201);
        expect(legacy.body.data).toMatchObject({
          applied: true,
          creates: 0,
          updates: 1,
        });
        expect(
          await prisma.productVariant.findUniqueOrThrow({
            where: { sku: canonicalSku },
          }),
        ).toMatchObject({ id: imported.id, msrpCents: 1200 });
        const legacyDuplicate = await prisma.productVariant.create({
          data: {
            productId: imported.productId,
            sku: canonicalSku.toLowerCase(),
            msrpCents: 600,
          },
        });
        const ambiguous = await api('post', '/admin/catalog/import')
          .set(await headers())
          .send({ rows: [{ ...row, msrpCents: 1 }], apply: true })
          .expect(201);
        expect(ambiguous.body.data.applied).toBe(false);
        expect(ambiguous.body.data.errors).toContain(
          `SKU ${canonicalSku} has multiple existing case variants; reconcile them before import`,
        );
        expect(
          await prisma.productVariant.findUniqueOrThrow({
            where: { id: imported.id },
          }),
        ).toMatchObject({ msrpCents: 1200 });
        await prisma.productVariant.delete({
          where: { id: legacyDuplicate.id },
        });
        await api('patch', '/admin/catalog/variants/' + imported.id)
          .set(await headers())
          .send({ b2bDefaultPriceCents: 900 })
          .expect(200);
        const company = await prisma.dealerCompany.create({
          data: {
            companyName: 'CSV procurement',
            legalRegNo: 'CSV-' + suffix,
            country: 'US',
            status: 'APPROVED',
            catalogPolicy: { productIds: [imported.productId] },
          },
        });
        companyId = company.id;
        const dealer = await prisma.user.create({
          data: {
            email: 'csv-dealer-' + suffix + '@example.test',
            name: 'CSV buyer',
            passwordHash: 'unused',
            ageConfirmed: true,
            status: 'ACTIVE',
            dealerMembers: {
              create: {
                companyId,
                role: 'OWNER',
                termsVersion: DEALER_TERMS_VERSION,
                termsAcceptedAt: new Date(),
              },
            },
          },
        });
        dealerId = dealer.id;
        const dealerToken = await authenticatedFixture(
          prisma,
          app.get(JwtService),
          dealer,
          'customer',
        );
        const quickOrder = await api('post', '/dealer/quick-order/validate')
          .set('Authorization', 'Bearer ' + dealerToken)
          .send({ lines: [{ sku: canonicalSku.toLowerCase(), quantity: 1 }] })
          .expect(201);
        expect(quickOrder.body.data.valid).toBe(true);
        expect(quickOrder.body.data.results[0]).toMatchObject({
          ok: true,
          sku: canonicalSku,
          unitPriceCents: 900,
        });
      } finally {
        if (dealerId) {
          await prisma.authenticationSession.deleteMany({
            where: { ownerId: dealerId },
          });
          await prisma.user.delete({ where: { id: dealerId } });
        }
        if (companyId)
          await prisma.dealerCompany.delete({ where: { id: companyId } });
        const importedVariants = await prisma.productVariant.findMany({
          where: { product: { slug: { in: [slug, otherSlug] } } },
          select: { id: true },
        });
        await prisma.retailPriceHistory.deleteMany({
          where: {
            variantId: { in: importedVariants.map((variant) => variant.id) },
          },
        });
        await prisma.product.deleteMany({
          where: { slug: { in: [slug, otherSlug] } },
        });
      }
    });
    it('returns typed related/accessory/replacement groups while excluding hidden and foreign-market targets', async () => {
      const targets = [];
      for (const [kind, status, markets] of [
        ['accessory', 'ACTIVE', ['US']],
        ['replacement', 'ACTIVE', ['US']],
        ['hidden', 'HIDDEN', ['US']],
        ['foreign', 'ACTIVE', ['GB']],
      ] as const) {
        const p = await prisma.product.create({
          data: {
            name: kind + ' ' + suffix,
            slug: kind + '-' + suffix,
            status,
            markets: [...markets],
          },
        });
        products.push(p.id);
        targets.push(p);
      }
      const associations = targets.map((p, index) => ({
        type: index === 1 ? 'REPLACEMENT' : 'ACCESSORY',
        slug: p.slug,
      }));
      await api('patch', '/admin/catalog/products/' + productId)
        .set(await headers())
        .send({ associations })
        .expect(200);
      const result = await api(
        'get',
        '/products/catalog-final-' + suffix + '?market=US',
      ).expect(200);
      expect(
        result.body.data.accessories.map((p: { id: string }) => p.id),
      ).toEqual([targets[0].id]);
      expect(
        result.body.data.replacements.map((p: { id: string }) => p.id),
      ).toEqual([targets[1].id]);
      expect(result.body.data.associations).toBeUndefined();
      expect(result.body.data.relatedSlugs).toBeUndefined();
      await api('patch', '/admin/catalog/products/' + productId)
        .set(await headers())
        .send({
          associations: [{ type: 'UNSUPPORTED', slug: targets[0].slug }],
        })
        .expect(400);
    });
  },
);

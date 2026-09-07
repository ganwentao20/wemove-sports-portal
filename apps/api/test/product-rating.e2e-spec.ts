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
import { publishedProductLanguages } from '../src/catalog/product-locales.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Product rating display and verified aggregate configuration (DB)',
  () => {
    const prisma = new PrismaClient(),
      key = randomUUID().slice(0, 8),
      secret = generateSecret();
    let app: INestApplication,
      staffId = '',
      token = '',
      productId = '',
      slug = '';
    const copied: string[] = [];
    beforeAll(async () => {
      app = (
        await Test.createTestingModule({ imports: [AppModule] }).compile()
      ).createNestApplication();
      await setupApp(app);
      await app.init();
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: 'SUPER_ADMIN' },
      });
      const staff = await prisma.staff.create({
        data: {
          email: 'rating-' + key + '@example.test',
          name: 'Rating operator',
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
      );
      const product = await prisma.product.create({
        data: {
          name: 'Rating fixture ' + key,
          slug: 'rating-' + key,
          status: 'ACTIVE',
          specifications: { weight: 5 },
        },
      });
      productId = product.id;
      slug = product.slug;
    });
    afterAll(async () => {
      await app?.close();
      await prisma.product.deleteMany({
        where: { id: { in: [productId, ...copied].filter(Boolean) } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorStaffId: staffId || 'no-fixture' },
      });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: staffId || 'no-fixture' },
      });
      if (staffId) await prisma.staff.delete({ where: { id: staffId } });
      await prisma.$disconnect();
    });
    const api = (path: string) =>
      request(app.getHttpServer()).get('/api/v1' + path);
    const save = async (
      body: object,
      path = '/admin/catalog/products/' + productId + '/reviews',
    ) =>
      request(app.getHttpServer())
        .patch('/api/v1' + path)
        .set('Authorization', 'Bearer ' + token)
        .set('x-mfa-code', await generate({ secret }))
        .send(body);
    const valid = {
      enabled: true,
      average: 4.25,
      count: 12,
      source: 'Isolated test fixture: imported review summary',
    };
    it('defaults to hidden, rejects empty or invalid ratings and unauthorized changes, and shares a source-backed aggregate without ordinary specification leakage', async () => {
      expect(
        (await api('/products/' + slug).expect(200)).body.data.rating,
      ).toBeNull();
      await request(app.getHttpServer())
        .patch('/api/v1/admin/catalog/products/' + productId + '/reviews')
        .send(valid)
        .expect(401);
      await request(app.getHttpServer())
        .patch('/api/v1/admin/catalog/products/' + productId + '/reviews')
        .set('Authorization', 'Bearer ' + token)
        .send(valid)
        .expect(403);
      expect((await save({ ...valid, count: 0 })).status).toBe(422);
      expect((await save({ ...valid, source: '' })).status).toBe(422);
      expect((await save({ ...valid, average: 0 })).status).toBe(422);
      expect((await save({ ...valid, average: 5.1 })).status).toBe(400);
      expect((await save({ ...valid, count: 1.5 })).status).toBe(400);
      expect((await save(valid)).status).toBe(200);
      const visible = (await api('/products/' + slug).expect(200)).body.data;
      expect(visible.rating).toEqual({
        average: 4.25,
        count: 12,
        source: valid.source,
      });
      expect(visible.specifications).toEqual({ weight: 5 });
      expect(
        await prisma.auditLog.count({
          where: {
            entityId: productId,
            actorStaffId: staffId,
            action: 'catalog.product.reviews',
          },
        }),
      ).toBe(1);
      expect(
        (
          await save(
            {
              specifications: { weight: 5, reviews: { ...valid, average: 9 } },
            },
            '/admin/catalog/products/' + productId,
          )
        ).status,
      ).toBe(422);
      expect((await save({ ...valid, enabled: false })).status).toBe(200);
      expect(
        (await api('/products/' + slug).expect(200)).body.data.rating,
      ).toBeNull();
      await prisma.product.update({
        where: { id: productId },
        data: {
          specifications: { weight: 5, reviews: { ...valid, count: 0 } },
        },
      });
      expect(
        (await api('/products/' + slug).expect(200)).body.data.rating,
      ).toBeNull();
    });
    it('does not inherit another product review history on copy or require aggregate metadata to be translated', async () => {
      expect((await save(valid)).status).toBe(200);
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/catalog/products/' + productId + '/copy')
        .set('Authorization', 'Bearer ' + token)
        .set('x-mfa-code', await generate({ secret }))
        .send({ slug: 'rating-copy-' + key, skuPrefix: 'RATING-' + key })
        .expect(201);
      copied.push(response.body.data.id);
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: response.body.data.id },
      });
      expect(
        (product.specifications as Record<string, unknown>).reviews,
      ).toMatchObject({ enabled: false, count: 0 });
      expect(
        publishedProductLanguages({
          specifications: {
            reviews: valid,
            translations: {
              fr: { status: 'PUBLISHED', name: 'Produit', summary: 'Résumé' },
            },
          },
        }),
      ).toContain('fr');
      const category = await prisma.productCategory.create({
        data: {
          code: 'RATING-' + key,
          slug: 'rating-category-' + key,
          name: 'Rating reserved metadata',
        },
      });
      try {
        await request(app.getHttpServer())
          .patch(
            '/api/v1/admin/catalog/categories/' + category.id + '/template',
          )
          .set('Authorization', 'Bearer ' + token)
          .set('x-mfa-code', await generate({ secret }))
          .send({
            attributeTemplate: [
              {
                key: 'reviews',
                label: 'Do not treat review metadata as a specification',
                type: 'text',
                required: true,
              },
            ],
            filterableFields: [],
          })
          .expect(422);
      } finally {
        await prisma.productCategory.delete({ where: { id: category.id } });
      }
    });
  },
);

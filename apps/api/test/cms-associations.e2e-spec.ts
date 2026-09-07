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

describe.skipIf(process.env.E2E_DB !== '1')(
  'CMS associations, ordered FAQ and localized indexing (DB)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID().slice(0, 8),
      secret = generateSecret();
    let app: INestApplication,
      staffId = '',
      token = '',
      productId = '',
      previousLocale: unknown = null;
    const pages: string[] = [];
    const api = (method: 'get' | 'post' | 'patch', path: string) =>
      request(app.getHttpServer())[method]('/api/v1' + path);
    const headers = async () => ({
      Authorization: 'Bearer ' + token,
      'x-mfa-code': await generate({ secret }),
    });
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
          name: 'CMS tester',
          email: `cms-rel-${suffix}@example.test`,
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
      const product = await prisma.product.create({
        data: {
          slug: 'cms-product-' + suffix,
          name: 'CMS product ' + suffix,
          summary: 'Source summary',
          status: 'ACTIVE',
          markets: ['US'],
          specifications: {
            translations: {
              zh: {
                status: 'PUBLISHED',
                name: '中文产品',
                summary: '中文摘要',
                seo: { noindex: true },
              },
            },
          },
        },
      });
      productId = product.id;
      previousLocale = await prisma.siteSetting.findUnique({
        where: { key: 'locale' },
      });
      await prisma.siteSetting.upsert({
        where: { key: 'locale' },
        create: {
          key: 'locale',
          value: { languages: ['en', 'zh'], fallback: 'DEFAULT' },
        },
        update: { value: { languages: ['en', 'zh'], fallback: 'DEFAULT' } },
      });
    });
    afterAll(async () => {
      if (previousLocale)
        await prisma.siteSetting.update({
          where: { key: 'locale' },
          data: { value: (previousLocale as { value: any }).value },
        });
      else await prisma.siteSetting.deleteMany({ where: { key: 'locale' } });
      await prisma.cmsRevision.deleteMany({ where: { pageId: { in: pages } } });
      await prisma.cmsPage.deleteMany({ where: { id: { in: pages } } });
      if (productId) await prisma.product.delete({ where: { id: productId } });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: staffId },
      });
      if (staffId) await prisma.staff.delete({ where: { id: staffId } });
      await app?.close();
      await prisma.$disconnect();
    });
    it('persists associated products and display order, filters public FAQ and restores its saved order', async () => {
      for (const [name, sortOrder, status, market] of [
        ['Second', 20, 'PUBLISHED', 'US'],
        ['First', 10, 'PUBLISHED', 'US'],
        ['Private', 0, 'DRAFT', 'US'],
        ['Foreign', 0, 'PUBLISHED', 'GB'],
      ] as const) {
        const response = await api('post', '/cms/pages')
          .set(await headers())
          .send({
            slug: `faq-${name.toLowerCase()}-${suffix}`,
            title: name + ' FAQ ' + suffix,
            kind: 'FAQ',
            status,
            market,
            productIds: [productId],
            sortOrder,
            sections: [{ type: 'text', props: { text: 'Associated answer' } }],
          })
          .expect(201);
        pages.push(response.body.data.id);
      }
      const listed = await api(
        'get',
        `/cms/pages?kind=FAQ&market=US&productId=${productId}`,
      ).expect(200);
      expect(
        listed.body.data.map((page: { sortOrder: number }) => page.sortOrder),
      ).toEqual([10, 20]);
      expect(listed.body.data.map((page: { id: string }) => page.id)).toEqual([
        pages[1],
        pages[0],
      ]);
      await api('patch', '/cms/pages/' + pages[0])
        .set(await headers())
        .send({ productIds: [], sortOrder: 3 })
        .expect(200);
      const restored = await api(
        'post',
        `/admin/cms/pages/${pages[0]}/restore/1`,
      )
        .set(await headers())
        .send({})
        .expect(201);
      expect(restored.body.data).toMatchObject({
        sortOrder: 20,
        productIds: [productId],
        status: 'DRAFT',
      });
      await api('patch', '/cms/pages/' + pages[0])
        .set(await headers())
        .send({ sortOrder: -1 })
        .expect(400);
      await api('patch', '/cms/pages/' + pages[0])
        .set(await headers())
        .send({ productIds: Array.from({ length: 25 }, (_, i) => 'id-' + i) })
        .expect(400);
      await api('get', '/admin/cms/products').expect(401);
      const references = await api(
        'get',
        '/admin/cms/products?ids=' + productId,
      )
        .set(await headers())
        .expect(200);
      expect(references.body.data).toEqual([
        expect.objectContaining({
          id: productId,
          name: 'CMS product ' + suffix,
        }),
      ]);
      expect(Object.keys(references.body.data[0]).sort()).toEqual([
        'id',
        'name',
        'slug',
        'status',
      ]);
    });
    it('indexes each product and content language according to its own public metadata', async () => {
      const content = await prisma.cmsPage.create({
        data: {
          slug: 'localized-seo-' + suffix,
          title: 'SEO page',
          status: 'PUBLISHED',
          sections: [],
          translations: {
            zh: {
              status: 'PUBLISHED',
              title: '中文页面',
              sections: [],
              seo: { noindex: true },
            },
          },
        },
      });
      pages.push(content.id);
      const ownPaths = (rows: Array<{ path: string }>) =>
        rows.filter((row) => row.path.includes(suffix)).map((row) => row.path);
      let en = await api('get', '/site/sitemaps?locale=en&market=US').expect(
          200,
        ),
        zh = await api('get', '/site/sitemaps?locale=zh&market=US').expect(200);
      expect(ownPaths(en.body.data.items)).toContain(
        '/products/cms-product-' + suffix,
      );
      expect(ownPaths(en.body.data.items)).toContain(
        '/content/' + content.slug,
      );
      expect(ownPaths(zh.body.data.items)).not.toContain(
        '/products/cms-product-' + suffix,
      );
      expect(ownPaths(zh.body.data.items)).not.toContain(
        '/content/' + content.slug,
      );
      await prisma.product.update({
        where: { id: productId },
        data: {
          seo: { noindex: true },
          specifications: {
            translations: {
              zh: {
                status: 'PUBLISHED',
                name: '中文产品',
                summary: '中文摘要',
                seo: { noindex: false },
              },
            },
          },
        },
      });
      await prisma.cmsPage.update({
        where: { id: content.id },
        data: {
          seo: { noindex: true },
          translations: {
            zh: {
              status: 'PUBLISHED',
              title: '中文页面',
              sections: [],
              seo: { noindex: false },
            },
          },
        },
      });
      en = await api('get', '/site/sitemaps?locale=en&market=US').expect(200);
      zh = await api('get', '/site/sitemaps?locale=zh&market=US').expect(200);
      expect(ownPaths(en.body.data.items)).not.toContain(
        '/products/cms-product-' + suffix,
      );
      expect(ownPaths(en.body.data.items)).not.toContain(
        '/content/' + content.slug,
      );
      expect(ownPaths(zh.body.data.items)).toContain(
        '/products/cms-product-' + suffix,
      );
      expect(ownPaths(zh.body.data.items)).toContain(
        '/content/' + content.slug,
      );
      const page = await api(
        'get',
        '/cms/pages/' + content.id + '?locale=zh&market=US',
      ).expect(200);
      expect(page.body.data.indexableLanguages).toEqual(['zh']);
      const detail = await api(
        'get',
        '/products/cms-product-' + suffix + '?locale=zh&market=US',
      ).expect(200);
      expect(detail.body.data).toMatchObject({
        seo: { noindex: false },
        indexableLanguages: ['zh'],
      });
    });
    it('supports all four product translation stages and never exposes a ready translation before publication', async () => {
      for (const status of ['NOT_STARTED', 'IN_PROGRESS', 'READY']) {
        await api('patch', '/admin/catalog/products/' + productId)
          .set(await headers())
          .send({
            specifications: {
              translations: {
                zh: { status, name: '工作译文', summary: '完整摘要' },
              },
            },
          })
          .expect(200);
        const page = await api(
          'get',
          '/products/cms-product-' + suffix + '?locale=zh&market=US',
        ).expect(200);
        expect(page.body.data.locale).toBe('en');
      }
      await api('patch', '/admin/catalog/products/' + productId)
        .set(await headers())
        .send({
          specifications: {
            translations: { zh: { status: 'READY', name: 'Incomplete' } },
          },
        })
        .expect(422);
      await api('patch', '/admin/catalog/products/' + productId)
        .set(await headers())
        .send({
          specifications: { translations: { zh: { status: 'UNKNOWN' } } },
        })
        .expect(422);
      await api('patch', '/admin/catalog/products/' + productId)
        .set(await headers())
        .send({
          specifications: {
            translations: {
              zh: {
                status: 'PUBLISHED',
                name: '发布译文',
                summary: '完整摘要',
              },
            },
          },
        })
        .expect(200);
      const page = await api(
        'get',
        '/products/cms-product-' + suffix + '?locale=zh&market=US',
      ).expect(200);
      expect(page.body.data).toMatchObject({ locale: 'zh', name: '发布译文' });
    });
  },
);

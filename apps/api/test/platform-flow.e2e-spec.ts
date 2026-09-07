import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { generate, generateSecret } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { authenticatedFixture } from './auth-session.js';
import { operationMetrics } from '../src/platform/reports.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Content, search, operations and notification platform (DB)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID().slice(0, 8),
      secret = generateSecret();
    let app: INestApplication,
      staffId = '',
      token = '',
      pageId = '',
      productId = '',
      contactId = '';
    const email = `platform-${suffix}@example.test`;
    const api = (
      method: 'get' | 'post' | 'patch' | 'put',
      path: string,
      auth = false,
    ) => {
      const r = request(app.getHttpServer())[method](`/api/v1${path}`);
      return auth ? r.set('Authorization', `Bearer ${token}`) : r;
    };
    const mfa = () => generate({ secret });
    beforeAll(async () => {
      const fixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = fixture.createNestApplication();
      await setupApp(app);
      await app.init();
      const role = await prisma.role.upsert({
        where: { code: 'SUPER_ADMIN' },
        create: { code: 'SUPER_ADMIN', name: 'Super administrator' },
        update: {},
      });
      const staff = await prisma.staff.create({
        data: {
          name: 'Platform tester',
          email,
          passwordHash: 'test-only',
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
    });
    afterAll(async () => {
      await prisma.cmsRevision.deleteMany({ where: { pageId } });
      await prisma.cmsPage.deleteMany({
        where: { slug: { contains: suffix } },
      });
      await prisma.siteRedirect.deleteMany({
        where: { source: { contains: suffix } },
      });
      await prisma.newsletterSubscription.deleteMany({ where: { email } });
      await prisma.notificationOutbox.deleteMany({
        where: { dedupeKey: { contains: suffix } },
      });
      await prisma.contactMessage.deleteMany({ where: { email } });
      await prisma.analyticsEvent.deleteMany({
        where: { path: { contains: suffix } },
      });
      if (productId) await prisma.product.delete({ where: { id: productId } });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: staffId },
      });
      if (staffId) await prisma.staff.delete({ where: { id: staffId } });
      await app?.close();
      await prisma.$disconnect();
    });
    it('requires staff and fresh MFA on CMS changes and creates a private draft', async () => {
      const dto = {
        slug: `article-${suffix}`,
        title: 'Draft content',
        kind: 'ARTICLE',
        sections: [{ type: 'text', props: { text: 'Draft paragraph' } }],
      };
      await api('post', '/cms/pages').send(dto).expect(401);
      await api('post', '/cms/pages', true).send(dto).expect(403);
      const r = await api('post', '/cms/pages', true)
        .set('x-mfa-code', await mfa())
        .send(dto)
        .expect(201);
      pageId = r.body.data.id;
      await api('get', `/cms/pages/${pageId}`).expect(404);
      await api('get', `/admin/cms/pages/${pageId}/preview`, true).expect(200);
    });
    it('publishes content without exposing translation drafts and rejects stale writes', async () => {
      await api('patch', `/cms/pages/${pageId}`, true)
        .set('x-mfa-code', await mfa())
        .send({
          expectedRevision: 1,
          status: 'PUBLISHED',
          translations: {
            zh: {
              status: 'IN_PROGRESS',
              title: 'Secret translation',
              sections: [],
            },
          },
        })
        .expect(200);
      const r = await api('get', `/cms/pages/${pageId}?locale=zh`).expect(200);
      expect(JSON.stringify(r.body)).not.toContain('Secret translation');
      expect(r.body.data.locale).toBe('en');
      await api('patch', `/cms/pages/${pageId}`, true)
        .set('x-mfa-code', await mfa())
        .send({ expectedRevision: 1, title: 'Stale' })
        .expect(409);
    });
    it('records immutable revisions and restores privately', async () => {
      const history = await api(
        'get',
        `/admin/cms/pages/${pageId}/versions`,
        true,
      ).expect(200);
      expect(history.body.data[0].revision).toBe(1);
      await api('post', `/admin/cms/pages/${pageId}/restore/1`, true)
        .set('x-mfa-code', await mfa())
        .send({})
        .expect(201);
      await api('get', `/cms/pages/${pageId}`).expect(404);
    });
    it('enforces start/end schedule and market visibility', async () => {
      await api('patch', `/cms/pages/${pageId}`, true)
        .set('x-mfa-code', await mfa())
        .send({
          status: 'SCHEDULED',
          publishAt: new Date(Date.now() + 3600_000).toISOString(),
          market: 'GB',
        })
        .expect(200);
      await api('get', `/cms/pages/${pageId}?market=GB`).expect(404);
      await prisma.cmsPage.update({
        where: { id: pageId },
        data: { publishAt: new Date(Date.now() - 1000) },
      });
      await api('get', `/cms/pages/${pageId}?market=GB`).expect(200);
      await api('get', `/cms/pages/${pageId}?market=US`).expect(404);
      await prisma.cmsPage.update({
        where: { id: pageId },
        data: { unpublishAt: new Date(Date.now() - 500) },
      });
      await api('get', `/cms/pages/${pageId}?market=GB`).expect(404);
    });
    it('searches live products and CMS with market, schedule and private-file isolation', async () => {
      const p = await prisma.product.create({
        data: {
          name: `Searchable ${suffix}`,
          slug: `search-${suffix}`,
          status: 'ACTIVE',
          markets: ['US'],
          summary: 'Bowling sets for active play',
        },
      });
      productId = p.id;
      const found = await api('get', `/search?q=${suffix}&market=US`).expect(
        200,
      );
      expect(
        found.body.data.items.some((x: { id: string }) => x.id === p.id),
      ).toBe(true);
      const foreign = await api('get', `/search?q=${suffix}&market=GB`).expect(
        200,
      );
      expect(
        foreign.body.data.items.some((x: { id: string }) => x.id === p.id),
      ).toBe(false);
      await prisma.product.update({
        where: { id: p.id },
        data: { unpublishAt: new Date(Date.now() - 1000) },
      });
      const expired = await api('get', `/search?q=${suffix}&market=US`).expect(
        200,
      );
      expect(
        expired.body.data.items.some((x: { id: string }) => x.id === p.id),
      ).toBe(false);
    });
    it('rejects redirect loops, protected paths and external redirect destinations', async () => {
      const a = `/${suffix}-old`,
        b = `/${suffix}-new`;
      await api('post', '/admin/seo/redirects', true)
        .set('x-mfa-code', await mfa())
        .send({ source: a, destination: b, status: 301 })
        .expect(201);
      await api('post', '/admin/seo/redirects', true)
        .set('x-mfa-code', await mfa())
        .send({ source: b, destination: a })
        .expect(400);
      await api('post', '/admin/seo/redirects', true)
        .set('x-mfa-code', await mfa())
        .send({ source: '/api/secure', destination: a })
        .expect(400);
      await api('post', '/admin/seo/redirects', true)
        .set('x-mfa-code', await mfa())
        .send({ source: a, destination: 'https://evil.test' })
        .expect(400);
    });
    it('stores consented analytics only and discards unknown properties', async () => {
      const path = `/${suffix}/search`;
      await api('post', '/analytics/events')
        .send({
          name: 'search',
          path,
          properties: { query: 'balance', email: 'private@example.test' },
          consent: false,
        })
        .expect(201);
      expect(await prisma.analyticsEvent.count({ where: { path } })).toBe(0);
      await api('post', '/analytics/events')
        .send({
          name: 'search',
          path,
          properties: {
            query: 'balance',
            email: 'private@example.test',
            results_count: 2,
          },
          consent: true,
        })
        .expect(201);
      const event = await prisma.analyticsEvent.findFirstOrThrow({
        where: { path },
      });
      expect(event.properties).toEqual({ query: 'balance', results_count: 2 });
    });
    it('persists encrypted deduplicated notifications and retains failed deliveries for retry', async () => {
      const service = app.get(NotificationsService),
        oldHost = process.env.SMTP_HOST,
        oldPort = process.env.SMTP_PORT;
      delete process.env.SMTP_HOST;
      try {
        const input = {
          kind: 'test',
          to: email,
          subject: 'Test delivery',
          text: 'Secret test payload',
          dedupeKey: `platform-${suffix}-message`,
        };
        const first = await service.enqueue(input),
          again = await service.enqueue(input);
        expect(again.id).toBe(first.id);
        let row = await prisma.notificationOutbox.findUniqueOrThrow({
          where: { id: first.id },
        });
        expect(row.payload).not.toContain(input.text);
        process.env.SMTP_HOST = '127.0.0.1';
        process.env.SMTP_PORT = '1';
        await service.deliver(first.id);
        row = await prisma.notificationOutbox.findUniqueOrThrow({
          where: { id: first.id },
        });
        expect(row.status).toBe('PENDING');
        expect(row.attempts).toBe(1);
        expect(row.lastError).toBe('DELIVERY_FAILED');
      } finally {
        if (oldHost === undefined) delete process.env.SMTP_HOST;
        else process.env.SMTP_HOST = oldHost;
        if (oldPort === undefined) delete process.env.SMTP_PORT;
        else process.env.SMTP_PORT = oldPort;
      }
    });
    it('requires subscription consent and invalidates unknown confirmation links', async () => {
      await api('post', '/newsletter')
        .send({
          email,
          locale: 'en',
          consent: false,
          consentVersion: '2026-09',
        })
        .expect(400);
      await api('post', '/newsletter')
        .send({ email, locale: 'en', consent: true, consentVersion: '2026-09' })
        .expect(201);
      expect(
        await prisma.newsletterSubscription.findUnique({ where: { email } }),
      ).toMatchObject({ status: 'PENDING' });
      await api('post', '/newsletter/confirm')
        .send({ token: 'a'.repeat(64) })
        .expect(404);
    });
    it('creates a support request and keeps internal notes separate from customer replies', async () => {
      const r = await api('post', '/contacts')
        .send({
          name: 'Platform test',
          email,
          subject: 'Test support',
          content: 'Please help with this test order.',
          source: 'ORDER_SUPPORT',
          consent: true,
          consentVersion: '2026-09',
        })
        .expect(201);
      contactId = r.body.data.id;
      await api('post', `/contacts/${contactId}/replies`, true)
        .set('x-mfa-code', await mfa())
        .send({ text: 'Internal handling note', internal: true })
        .expect(201);
      const row = await prisma.contactMessage.findUniqueOrThrow({
        where: { id: contactId },
      });
      expect(JSON.stringify(row.history)).toContain('Internal handling note');
      await api('get', '/contacts').expect(401);
    });
    it('reports consented funnels and support outcomes without leaking financial amounts to readers', async () => {
      const path = `/${suffix}/report`,
        session = randomUUID(),
        product = `product-${suffix}`;
      for (const name of ['view_product', 'add_to_cart', 'purchase'])
        await api('post', '/analytics/events')
          .send({
            name,
            path,
            consent: true,
            properties: { session_id: session, product_id: product },
          })
          .expect(201);
      const report = await api('get', '/admin/reports', true).expect(200);
      const row = report.body.data.metrics.products.find(
        (item: { product: string }) => item.product === product,
      );
      expect(row).toMatchObject({
        views: 1,
        addToCart: 1,
        purchases: 1,
        addToCartRate: 100,
        purchaseRate: 100,
      });
      const reader = await operationMetrics(app.get(PrismaService), false);
      expect(JSON.stringify(reader.sales)).not.toContain('paidCents');
      await api('get', '/admin/reports/export', true).expect(403);
      const exported = await api('get', '/admin/reports/export', true)
        .set('x-mfa-code', await mfa())
        .expect(200);
      expect(exported.text).toContain(product);
    });
    it('returns field errors and rejects contact without consent or another upload capability', async () => {
      const invalid = await api('post', '/contacts')
        .send({ name: 'A', email: 'invalid' })
        .expect(400);
      expect(invalid.body.field_errors.email).toBeTruthy();
      expect(invalid.body.request_id).toBeTruthy();
      await api('post', '/contacts')
        .send({
          name: 'Test',
          email,
          subject: 'Attachment test',
          content: 'This must not accept another file.',
          consent: true,
          consentVersion: '2026-09',
          attachments: [{ mediaId: 'unknown', attachmentToken: 'unknown' }],
        })
        .expect(400);
    });

    it('restores all page metadata and advances revisions for SEO and archival', async () => {
      const slug = 'version-' + suffix,
        original = {
          slug,
          title: 'Version original',
          kind: 'ARTICLE',
          author: 'Original author',
          category: 'Learning',
          market: 'US',
          locale: 'en',
          productIds: ['fixture-product'],
          publishAt: new Date(Date.now() - 86400000).toISOString(),
          sections: [{ type: 'text', props: { text: 'Original content' } }],
          seo: { description: 'Original metadata' },
        };
      const created = await api('post', '/cms/pages', true)
          .set('x-mfa-code', await mfa())
          .send(original)
          .expect(201),
        id = created.body.data.id;
      try {
        await api('patch', '/cms/pages/' + id, true)
          .set('x-mfa-code', await mfa())
          .send({
            slug: slug + '-changed',
            author: 'Changed',
            category: 'Other',
            market: 'GB',
            kind: 'FAQ',
            productIds: [],
            publishAt: null,
            expectedRevision: 1,
          })
          .expect(200);
        const restored = await api(
          'post',
          '/admin/cms/pages/' + id + '/restore/1',
          true,
        )
          .set('x-mfa-code', await mfa())
          .send({})
          .expect(201);
        expect(restored.body.data).toMatchObject({
          ...original,
          status: 'DRAFT',
          revision: 3,
        });
        expect(
          await prisma.siteRedirect.findUnique({
            where: { source: '/content/' + slug },
          }),
        ).toBeNull();
        expect(
          await prisma.siteRedirect.findUnique({
            where: { source: '/content/' + slug + '-changed' },
          }),
        ).toMatchObject({ destination: '/content/' + slug });
        await api('patch', '/seo/' + id, true)
          .set('x-mfa-code', await mfa())
          .send({ meta_description: 'New SEO' })
          .expect(200);
        await api('patch', '/cms/pages/' + id, true)
          .set('x-mfa-code', await mfa())
          .send({ title: 'stale', expectedRevision: 3 })
          .expect(409);
        await request(app.getHttpServer())
          .delete('/api/v1/cms/pages/' + id)
          .set('Authorization', 'Bearer ' + token)
          .set('x-mfa-code', await mfa())
          .expect(200);
        expect(
          await prisma.cmsPage.findUnique({ where: { id } }),
        ).toMatchObject({ status: 'ARCHIVED', revision: 5 });
        expect(await prisma.cmsRevision.count({ where: { pageId: id } })).toBe(
          4,
        );
      } finally {
        await prisma.cmsRevision.deleteMany({ where: { pageId: id } });
        await prisma.cmsPage.delete({ where: { id } });
      }
    });
    it('uses enabled, published translations consistently in content, search and segmented sitemaps', async () => {
      const previous = await prisma.siteSetting.findUnique({
        where: { key: 'locale' },
      });
      const slug = 'localized-article-' + suffix;
      const p = await prisma.cmsPage.create({
        data: {
          slug,
          title: 'Search locale ' + suffix,
          kind: 'ARTICLE',
          status: 'PUBLISHED',
          market: 'US',
          sections: [{ type: 'text', props: { text: 'English body' } }],
          translations: {
            zh: {
              status: 'IN_PROGRESS',
              title: 'Private ' + suffix,
              sections: [{ type: 'text', props: { text: '私有草稿' } }],
            },
          },
        },
      });
      const setPolicy = (languages: string[], fallback: string) =>
        prisma.siteSetting.upsert({
          where: { key: 'locale' },
          create: { key: 'locale', value: { languages, fallback } },
          update: { value: { languages, fallback } },
        });
      try {
        await setPolicy(['en', 'zh'], 'HIDE');
        await api('get', '/cms/pages/' + p.id + '?locale=zh&market=US').expect(
          404,
        );
        const hidden = await api(
          'get',
          '/search?q=' + suffix + '&locale=zh&market=US',
        ).expect(200);
        expect(
          hidden.body.data.items.some((r: { id: string }) => r.id === p.id),
        ).toBe(false);
        let map = await api('get', '/site/sitemaps?locale=zh&market=US').expect(
          200,
        );
        expect(
          map.body.data.items.some((r: { path: string }) =>
            r.path.includes(slug),
          ),
        ).toBe(false);
        await prisma.cmsPage.update({
          where: { id: p.id },
          data: {
            translations: {
              zh: {
                status: 'PUBLISHED',
                title: '公开内容 ' + suffix,
                sections: [{ type: 'text', props: { text: '已完成译文' } }],
              },
            },
          },
        });
        const page = await api(
          'get',
          '/cms/pages/' + p.id + '?locale=zh&market=US',
        ).expect(200);
        expect(page.body.data.locale).toBe('zh');
        map = await api('get', '/site/sitemaps?locale=zh&market=US').expect(
          200,
        );
        expect(
          map.body.data.items.find((r: { path: string }) =>
            r.path.includes(slug),
          ),
        ).toMatchObject({ locale: 'zh', languages: ['en', 'zh'] });
        const search = await api(
          'get',
          '/search?q=' + suffix + '&locale=zh&market=US',
        ).expect(200);
        expect(
          search.body.data.items.find((r: { id: string }) => r.id === p.id),
        ).toMatchObject({ locale: 'zh', title: '公开内容 ' + suffix });
        const foreign = await api(
          'get',
          '/site/sitemaps?locale=zh&market=GB',
        ).expect(200);
        expect(
          foreign.body.data.items.some((r: { path: string }) =>
            r.path.includes(slug),
          ),
        ).toBe(false);
        await api('put', '/admin/settings/locale', true)
          .set('x-mfa-code', await mfa())
          .send({
            value: {
              languages: ['en', 'zh', 'fr', 'pt-BR'],
              defaultLanguage: 'en',
              fallback: 'DEFAULT',
            },
          })
          .expect(200);
        const config = await api('get', '/site/sitemaps/config').expect(200);
        expect(config.body.data.languages).toEqual(['en', 'zh', 'fr', 'pt-BR']);
        const fallback = await api(
          'get',
          `/cms/pages/${p.id}?locale=fr`,
        ).expect(200);
        expect(fallback.body.data.locale).toBe('en');
        await api('patch', `/cms/pages/${p.id}`, true)
          .set('x-mfa-code', await mfa())
          .send({
            translations: {
              fr: {
                status: 'PUBLISHED',
                title: 'Version française ' + suffix,
                sections: [
                  {
                    type: 'text',
                    props: { text: 'Texte entièrement traduit.' },
                  },
                ],
              },
              'pt-BR': {
                status: 'IN_PROGRESS',
                title: 'Tradução privada',
                sections: [],
              },
            },
          })
          .expect(200);
        const french = await api(
          'get',
          `/cms/pages/${p.id}?locale=fr&market=US`,
        ).expect(200);
        expect(french.body.data).toMatchObject({
          locale: 'fr',
          title: 'Version française ' + suffix,
        });
        expect(JSON.stringify(french.body.data)).not.toContain(
          'Tradução privada',
        );
        const frenchSearch = await api(
          'get',
          `/search?q=${suffix}&locale=fr&market=US`,
        ).expect(200);
        expect(
          frenchSearch.body.data.items.find(
            (row: { id: string }) => row.id === p.id,
          )?.locale,
        ).toBe('fr');
        const frenchMap = await api(
          'get',
          '/site/sitemaps?locale=fr&market=US',
        ).expect(200);
        expect(
          frenchMap.body.data.items.find((row: { path: string }) =>
            row.path.includes(slug),
          ),
        ).toMatchObject({ locale: 'fr', languages: ['en', 'fr'] });
        await api('put', '/admin/settings/locale', true)
          .set('x-mfa-code', await mfa())
          .send({
            value: {
              languages: ['en', 'fr', 'pt-BR'],
              defaultLanguage: 'en',
              fallback: 'HIDE',
            },
          })
          .expect(200);
        await api('get', `/cms/pages/${p.id}?locale=pt-BR`).expect(404);
        await api('get', `/cms/pages/${p.id}?locale=fr_fr`).expect(400);
        await api('put', '/admin/settings/locale', true)
          .set('x-mfa-code', await mfa())
          .send({
            value: {
              languages: ['en', 'EN'],
              defaultLanguage: 'en',
              fallback: 'HIDE',
            },
          })
          .expect(400);
        await setPolicy(['en'], 'DEFAULT');
        await api('get', '/cms/pages/' + p.id + '?locale=zh').expect(404);
        await api('get', '/search?q=' + suffix + '&locale=zh').expect(400);
        map = await api('get', '/site/sitemaps?locale=zh').expect(200);
        expect(map.body.data.items).toEqual([]);
      } finally {
        if (previous)
          await prisma.siteSetting.update({
            where: { key: 'locale' },
            data: { value: previous.value! },
          });
        else await prisma.siteSetting.deleteMany({ where: { key: 'locale' } });
        await prisma.cmsRevision.deleteMany({ where: { pageId: p.id } });
        await prisma.cmsPage.delete({ where: { id: p.id } });
      }
    });

    it('changes the public cache key after a commit and at a scheduled publication boundary', async () => {
      const first = await api('get', '/site/cache-version').expect(200);
      expect(first.headers['cache-control']).toBe('no-store');
      expect(first.body.data.revision).toMatch(/^[a-f0-9]{64}$/);
      let id = '',
        during = '';
      try {
        await prisma.$transaction(async (tx) => {
          const p = await tx.cmsPage.create({
            data: {
              slug: 'cache-' + suffix,
              title: 'Cache publication',
              status: 'DRAFT',
              sections: [],
            },
          });
          id = p.id;
          during = (await api('get', '/site/cache-version').expect(200)).body
            .data.revision;
        });
        const committed = (await api('get', '/site/cache-version').expect(200))
          .body.data.revision;
        expect(committed).not.toBe(first.body.data.revision);
        expect(committed).not.toBe(during);
        await prisma.cmsPage.update({
          where: { id },
          data: { status: 'SCHEDULED', publishAt: new Date(Date.now() + 700) },
        });
        const scheduled = (await api('get', '/site/cache-version').expect(200))
          .body.data.revision;
        await api('get', '/cms/pages/' + id).expect(404);
        await new Promise((resolve) => setTimeout(resolve, 800));
        const published = (await api('get', '/site/cache-version').expect(200))
          .body.data.revision;
        expect(published).not.toBe(scheduled);
        await api('get', '/cms/pages/' + id).expect(200);
      } finally {
        if (id) await prisma.cmsPage.delete({ where: { id } });
      }
    });

    it('imports redirects atomically and validates nested paths and cross-row cycles', async () => {
      const source = '/' + suffix + '-batch',
        destination = '/' + suffix + '-target';
      await api('post', '/admin/seo/redirects/import', true)
        .set('x-mfa-code', await mfa())
        .send({
          items: [
            { source, destination },
            { source: destination, destination: source },
          ],
        })
        .expect(400);
      expect(await prisma.siteRedirect.count({ where: { source } })).toBe(0);
      await api('post', '/admin/seo/redirects/import', true)
        .set('x-mfa-code', await mfa())
        .send({
          items: [
            { source, destination },
            { source: destination, destination: 'https://invalid.test' },
          ],
        })
        .expect(400);
      await api('post', '/admin/seo/redirects/import', true)
        .set('x-mfa-code', await mfa())
        .send({
          items: [
            { source, destination, status: 301 },
            { source: destination, destination: '/products', status: 302 },
          ],
        })
        .expect(201);
      expect(
        await prisma.siteRedirect.findUnique({ where: { source } }),
      ).toMatchObject({ destination, status: 301 });
    });
    it('indexes category terms, excludes hidden module bodies and preserves safe commerce analytics', async () => {
      const category = await prisma.productCategory.create({
        data: {
          code: 'category-' + suffix,
          slug: 'category-' + suffix,
          name: 'Category ' + suffix,
        },
      });
      const product = await prisma.product.create({
        data: {
          name: 'Quiet product',
          slug: 'category-product-' + suffix,
          status: 'ACTIVE',
          categoryId: category.id,
        },
      });
      const page = await prisma.cmsPage.create({
        data: {
          slug: 'article-modules-' + suffix,
          title: 'Module visibility',
          kind: 'ARTICLE',
          status: 'PUBLISHED',
          sections: [
            {
              type: 'text',
              props: { text: 'hiddenmodule' + suffix, enabled: false },
            },
            {
              type: 'text',
              props: {
                text: 'futuremodule' + suffix,
                publishAt: new Date(Date.now() + 3600000).toISOString(),
              },
            },
            { type: 'text', props: { text: 'visiblemodule' + suffix } },
          ],
        },
      });
      try {
        const search = await api(
          'get',
          '/search?q=' + encodeURIComponent(category.name),
        ).expect(200);
        expect(
          search.body.data.items.some(
            (row: { id: string }) => row.id === product.id,
          ),
        ).toBe(true);
        for (const prefix of ['hiddenmodule', 'futuremodule']) {
          const hidden = await api(
            'get',
            '/search?q=' + prefix + suffix,
          ).expect(200);
          expect(
            hidden.body.data.items.some(
              (row: { id: string }) => row.id === page.id,
            ),
          ).toBe(false);
        }
        const visible = await api(
          'get',
          '/search?q=visiblemodule' + suffix,
        ).expect(200);
        expect(
          visible.body.data.items.some(
            (row: { id: string }) => row.id === page.id,
          ),
        ).toBe(true);
        const path = '/' + suffix + '/quote';
        await api('post', '/analytics/events')
          .send({
            name: 'request_quote',
            path,
            consent: true,
            properties: {
              channel: 'B2B',
              revenue: 25,
              filter_name: 'category',
              value: category.code,
              items: [
                {
                  product_id: product.id,
                  qty: 2,
                  email: 'private@example.test',
                },
              ],
              email: 'private@example.test',
            },
          })
          .expect(201);
        const stored = await prisma.analyticsEvent.findFirstOrThrow({
          where: { path },
        });
        expect(stored.properties).toMatchObject({
          channel: 'B2B',
          revenue: 25,
          items: [{ product_id: product.id, qty: 2 }],
        });
        expect(JSON.stringify(stored.properties)).not.toContain(
          'private@example.test',
        );
        const report = await operationMetrics(app.get(PrismaService), true);
        expect(
          report.products.find(
            (row) => (row as Record<string, unknown>).product === product.id,
          ),
        ).toMatchObject({ inquiries: 1 });
      } finally {
        await prisma.cmsPage.delete({ where: { id: page.id } });
        await prisma.product.delete({ where: { id: product.id } });
        await prisma.productCategory.delete({ where: { id: category.id } });
      }
    });

    it('records consented field vitals and reports the latest sample without duplicates', async () => {
      const path = '/' + suffix + '/vitals',
        id = 'vital-' + suffix;
      await api('post', '/analytics/events')
        .send({
          name: 'web_vital',
          path,
          consent: true,
          properties: { metric_name: 'INP', metric_value: -1, metric_id: id },
        })
        .expect(400);
      for (const value of [250, 120])
        await api('post', '/analytics/events')
          .send({
            name: 'web_vital',
            path,
            consent: true,
            properties: {
              metric_name: 'INP',
              metric_value: value,
              metric_id: id,
              device: 'fixture-' + suffix,
              rating: 'good',
            },
          })
          .expect(201);
      const report = await operationMetrics(app.get(PrismaService), false);
      expect(
        report.vitals.find((row) => row.device === 'fixture-' + suffix),
      ).toMatchObject({ metric: 'INP', samples: 1, p75: 120 });
    });
  },
);

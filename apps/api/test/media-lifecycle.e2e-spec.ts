import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { generate, generateSecret } from 'otplib';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFile, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { searchQuery } from '../src/platform/search-query.js';
import { MediaService } from '../src/media/media.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { authenticatedFixture } from './auth-session.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Media lifecycle (DB, files, scanner HTTP)',
  () => {
    const prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const secret = generateSecret();
    const ownerIds: string[] = [],
      companyIds: string[] = [],
      assetIds: string[] = [];
    let app: INestApplication,
      staff = '',
      staffId = '',
      dealerA = '',
      dealerB = '',
      imageId = '',
      scanner: Server,
      scannerClean = true,
      scanUrl = '';
    let imageBuffer: Buffer;
    const api = (
      method: 'get' | 'post' | 'patch' | 'delete',
      path: string,
      token = staff,
    ) =>
      request(app.getHttpServer())
        [method](`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`);
    const headers = async () => ({ 'x-mfa-code': await generate({ secret }) });

    beforeAll(async () => {
      vi.stubEnv('MEDIA_SCAN_URL', '');
      vi.stubEnv('MEDIA_CLEANUP_WORKER', 'false');
      vi.stubEnv('MEDIA_SCAN_REQUIRED', 'false');
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      await setupApp(app);
      await app.init();
      const jwt = app.get(JwtService);
      const role = await prisma.role.upsert({
        where: { code: 'SUPER_ADMIN' },
        create: { code: 'SUPER_ADMIN', name: 'Super Admin' },
        update: {},
      });
      const admin = await prisma.staff.create({
        data: {
          email: `media-admin-${suffix}@example.test`,
          name: 'Media admin',
          passwordHash: 'unused',
          mfaEnabled: true,
          mfaSecret: secret,
          roles: { create: { roleId: role.id } },
        },
      });
      staffId = admin.id;
      staff = await authenticatedFixture(prisma, jwt, admin, 'staff');
      for (const name of ['A', 'B']) {
        const user = await prisma.user.create({
          data: {
            email: `media-${name}-${suffix}@example.test`,
            name,
            status: 'ACTIVE',
            ageConfirmed: true,
            passwordHash: 'unused',
          },
        });
        ownerIds.push(user.id);
        const company = await prisma.dealerCompany.create({
          data: {
            companyName: `Media ${name} ${suffix}`,
            legalRegNo: `MEDIA-${name}-${suffix}`,
            country: 'US',
            status: 'APPROVED',
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
                termsVersion: 'dealer-terms-2026-09',
                termsAcceptedAt: new Date(),
              },
            },
          },
        });
        companyIds.push(company.id);
        const token = await authenticatedFixture(prisma, jwt, user, 'customer');
        if (name === 'A') dealerA = token;
        else dealerB = token;
      }
      imageBuffer = await sharp({
        create: { width: 900, height: 600, channels: 3, background: '#137e81' },
      })
        .png()
        .toBuffer();
      scanner = createServer((req, res) => {
        req.resume();
        req.on('end', () => {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ clean: scannerClean }));
        });
      });
      await new Promise<void>((resolve) =>
        scanner.listen(0, '127.0.0.1', resolve),
      );
      const address = scanner.address();
      if (!address || typeof address === 'string')
        throw new Error('scanner port missing');
      scanUrl = `http://127.0.0.1:${address.port}`;
    });
    afterAll(async () => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      await prisma.siteSetting.deleteMany({
        where: { key: { in: assetIds.map((id) => `media-cleanup:${id}`) } },
      });
      const files = await prisma.mediaAsset.findMany({
        where: { id: { in: assetIds } },
      });
      await prisma.mediaAsset.deleteMany({ where: { id: { in: assetIds } } });
      await Promise.all(
        files.map((file) =>
          unlink(join(process.cwd(), 'media_private', file.key)).catch(
            () => undefined,
          ),
        ),
      );
      await prisma.dealerCompany.deleteMany({
        where: { id: { in: companyIds } },
      });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [...ownerIds, staffId] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
      if (staffId) await prisma.staff.deleteMany({ where: { id: staffId } });
      await prisma.$disconnect();
      await app?.close();
      if (scanner)
        await new Promise<void>((resolve) => scanner.close(() => resolve()));
    });

    it('uploads an image, creates usable responsive variants and deduplicates identical content', async () => {
      const uploaded = await api('post', '/media/upload')
        .set(await headers())
        .field('visibility', 'DEALER_ONLY')
        .attach('file', imageBuffer, 'catalog.png')
        .expect(201);
      imageId = uploaded.body.data.id;
      assetIds.push(imageId);
      const original = await prisma.mediaAsset.findUniqueOrThrow({
        where: { id: imageId },
      });
      const derivatives = original.derivatives as Array<{
        mediaId: string;
        width: number;
      }>;
      assetIds.push(...derivatives.map((item) => item.mediaId));
      expect(original.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(derivatives.map((item) => item.width)).toEqual([320, 768, 1440]);
      const duplicate = await api('post', '/media/upload')
        .set(await headers())
        .field('visibility', 'DEALER_ONLY')
        .attach('file', imageBuffer, 'renamed.png')
        .expect(201);
      expect(duplicate.body.data).toMatchObject({
        id: imageId,
        deduplicated: true,
      });
      for (const item of derivatives) {
        const asset = await prisma.mediaAsset.findUniqueOrThrow({
          where: { id: item.mediaId },
        });
        const dimensions = await sharp(
          await readFile(join(process.cwd(), 'media_private', asset.key)),
        ).metadata();
        expect(dimensions.width).toBe(Math.min(item.width, 900));
        expect(dimensions.format).toBe('webp');
      }
    });

    it('propagates company grants to variants and requires scoped signatures for original and thumbnail', async () => {
      await api('patch', `/media/${imageId}/metadata`)
        .set(await headers())
        .send({
          alt: 'Dealer catalog',
          usageLocations: ['dealer/catalog'],
          companyIds: [companyIds[0]],
          productIds: [],
        })
        .expect(200);
      const original = await prisma.mediaAsset.findUniqueOrThrow({
        where: { id: imageId },
      });
      const derivative = (original.derivatives as Array<{ mediaId: string }>)[0]
        .mediaId;
      for (const id of [imageId, derivative]) {
        await api('get', `/media/${id}/access`, dealerB).expect(403);
        await request(app.getHttpServer())
          .get(`/api/v1/media/${id}/download`)
          .expect(403);
        const signed = await api('get', `/media/${id}/access`, dealerA).expect(
          200,
        );
        expect(signed.body.data.expireSeconds).toBeLessThanOrEqual(300);
        await request(app.getHttpServer())
          .get(`/api/v1${signed.body.data.url}`)
          .expect(200);
      }
      await api('delete', `/media/${derivative}`)
        .set(await headers())
        .expect(409);
      await api('delete', `/media/${imageId}`)
        .set(await headers())
        .expect(409);
      await prisma.mediaAsset.update({
        where: { id: imageId },
        data: { usageLocations: [] },
      });
      const key = `media-reference-${suffix}`;
      await prisma.siteSetting.create({
        data: { key, value: { logo: `/media/${imageId}/download` } },
      });
      try {
        await api('delete', `/media/${imageId}`)
          .set(await headers())
          .expect(409);
      } finally {
        await prisma.siteSetting.delete({ where: { key } });
      }
    });

    it('blocks previously unscanned originals and variants when scanning becomes required; rescans through scanner HTTP', async () => {
      vi.stubEnv('MEDIA_SCAN_REQUIRED', 'true');
      await api('get', `/media/${imageId}/access`, dealerA).expect(403);
      const blockedList = await api('get', '/media/downloads', dealerA).expect(
        200,
      );
      expect(
        blockedList.body.data.some(
          (item: { id: string }) => item.id === imageId,
        ),
      ).toBe(false);
      vi.stubEnv('MEDIA_SCAN_URL', scanUrl);
      const clean = await api('post', `/media/${imageId}/rescan`)
        .set(await headers())
        .expect(201);
      expect(clean.body.data.scanStatus).toBe('CLEAN');
      const all = await prisma.mediaAsset.findMany({
        where: { id: { in: assetIds } },
      });
      expect(all.every((item) => item.scanStatus === 'CLEAN')).toBe(true);
      await api('get', `/media/${imageId}/access`, dealerA).expect(200);
      scannerClean = false;
      await api('post', `/media/${imageId}/rescan`)
        .set(await headers())
        .expect(422);
      const quarantined = await prisma.mediaAsset.findMany({
        where: { id: { in: assetIds } },
      });
      expect(
        quarantined.every((item) => item.scanStatus === 'QUARANTINED'),
      ).toBe(true);
      await api('get', `/media/${imageId}/access`, dealerA).expect(403);
      scannerClean = true;
    });

    it('removes generated variant records and files with their original after usage is cleared', async () => {
      await api('patch', `/media/${imageId}/metadata`)
        .set(await headers())
        .send({
          alt: '',
          usageLocations: [],
          companyIds: [companyIds[0]],
          productIds: [],
        })
        .expect(200);
      const files = await prisma.mediaAsset.findMany({
        where: { id: { in: assetIds } },
      });
      await api('delete', `/media/${imageId}`)
        .set(await headers())
        .expect(200);
      expect(
        await prisma.mediaAsset.count({ where: { id: { in: assetIds } } }),
      ).toBe(0);
      for (const file of files)
        await expect(
          stat(join(process.cwd(), 'media_private', file.key)),
        ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('publishes localized resource metadata consistently across downloads, signed access and SQL search', async () => {
      const file = Buffer.from('%PDF-1.7\n% metadata ' + suffix + '\n%%EOF');
      const upload = await api('post', '/media/upload')
        .set(await headers())
        .field('visibility', 'PUBLIC')
        .attach('file', file, 'manual.pdf')
        .expect(201);
      const id = upload.body.data.id;
      assetIds.push(id);
      const title = '中文说明书 ' + suffix;
      const metadata = {
        alt: 'Training manual',
        title,
        language: 'zh',
        resourceType: 'MANUAL',
        tags: ['平衡训练', suffix],
        decorative: false,
        publishedAt: new Date(Date.now() + 3600000).toISOString(),
        usageLocations: [],
        companyIds: [],
        productIds: [],
      };
      await api('patch', '/media/' + id + '/metadata')
        .set(await headers())
        .send(metadata)
        .expect(200);
      await api('patch', '/media/' + id + '/metadata')
        .set(await headers())
        .send({ ...metadata, language: '../../evil' })
        .expect(400);
      expect(
        (await api('get', '/media/public').expect(200)).body.data.some(
          (m: { id: string }) => m.id === id,
        ),
      ).toBe(false);
      await request(app.getHttpServer())
        .get('/api/v1/media/' + id + '/download')
        .expect(403);
      await api('get', '/media/' + id + '/access', dealerA).expect(403);
      const search = (locale: string) =>
        prisma.$queryRaw<
          Array<{
            total: number;
            items: Array<{ id: string; title: string; locale: string }>;
          }>
        >(searchQuery([suffix], locale, 'CN', 'DOWNLOAD', 1, true));
      expect((await search('zh'))[0].items.some((row) => row.id === id)).toBe(
        false,
      );
      await api('patch', '/media/' + id + '/metadata')
        .set(await headers())
        .send({
          ...metadata,
          publishedAt: new Date(Date.now() - 1000).toISOString(),
        })
        .expect(200);
      const listed = await api('get', '/media/public').expect(200);
      expect(
        listed.body.data.find((m: { id: string }) => m.id === id),
      ).toMatchObject({
        title,
        language: 'zh',
        resourceType: 'MANUAL',
        tags: ['平衡训练', suffix],
        version: 1,
      });
      await request(app.getHttpServer())
        .get('/api/v1/media/' + id + '/download')
        .expect(200);
      expect(
        (await search('zh'))[0].items.find((row) => row.id === id),
      ).toMatchObject({ title, locale: 'zh' });
      expect((await search('en'))[0].items.some((row) => row.id === id)).toBe(
        false,
      );
    });

    it('quarantines failed privacy deletions and retries the durable job after service restart', async () => {
      const service = app.get(MediaService);
      const buffer = Buffer.from(
        '%PDF-1.7\n% Privacy qualification ' + suffix + '\n%%EOF',
      );
      const stored = await service.createDealerAttachment({
        buffer,
        size: buffer.length,
        originalname: 'personal-license.pdf',
        mimetype: 'application/pdf',
      });
      assetIds.push(stored.mediaId);
      const file = await prisma.mediaAsset.findUniqueOrThrow({
        where: { id: stored.mediaId },
      });
      const deletion = vi
        .spyOn(service, 'delete')
        .mockRejectedValueOnce(new Error('file temporarily locked'));
      const result = await service.deleteUnreferencedQualifications(
        [stored.mediaId],
        {
          sub: staffId,
          kind: 'staff',
          email: 'media-admin-' + suffix + '@example.test',
          name: 'Media admin',
        },
      );
      expect(result).toEqual({
        deleted: [],
        retained: [],
        queued: [stored.mediaId],
      });
      expect(
        await prisma.mediaAsset.findUnique({ where: { id: stored.mediaId } }),
      ).toMatchObject({
        scanStatus: 'PENDING_DELETE',
        fileName: 'removed-qualification',
      });
      await expect(service.sign(stored.mediaId)).rejects.toMatchObject({
        status: 403,
      });
      await api('post', '/media/' + stored.mediaId + '/rescan')
        .set(await headers())
        .expect(409);
      const jobs = await api('get', '/media/cleanup-jobs').expect(200);
      expect(
        jobs.body.data.some(
          (job: { mediaId: string }) => job.mediaId === stored.mediaId,
        ),
      ).toBe(true);
      deletion.mockRestore();
      const restarted = new MediaService(
        app.get(PrismaService),
        app.get(AuditService),
      );
      await Promise.all([
        restarted.drainQualificationCleanup(),
        service.drainQualificationCleanup(),
      ]);
      expect(
        await prisma.mediaAsset.findUnique({ where: { id: stored.mediaId } }),
      ).toBeNull();
      expect(
        await prisma.siteSetting.findUnique({
          where: { key: 'media-cleanup:' + stored.mediaId },
        }),
      ).toBeNull();
      await expect(
        stat(join(process.cwd(), 'media_private', file.key)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('retains version predecessors and rejects cyclic replacement histories', async () => {
      const versions: string[] = [];
      for (const version of [1, 2]) {
        const file = Buffer.from(
          `%PDF-1.7\n% media version ${version} ${suffix}\n%%EOF`,
        );
        const uploaded = await api('post', '/media/upload')
          .set(await headers())
          .field('visibility', 'REGISTERED')
          .attach('file', file, `catalog-v${version}.pdf`)
          .expect(201);
        versions.push(uploaded.body.data.id);
        assetIds.push(uploaded.body.data.id);
      }
      const data = {
        alt: 'Replacement catalog',
        usageLocations: [],
        companyIds: [],
        productIds: [],
      };
      const changed = await api('patch', `/media/${versions[1]}/metadata`)
        .set(await headers())
        .send({ ...data, previousVersionId: versions[0] })
        .expect(200);
      expect(changed.body.data.version).toBe(2);
      await api('patch', `/media/${versions[0]}/metadata`)
        .set(await headers())
        .send({ ...data, previousVersionId: versions[1] })
        .expect(409);
      await api('delete', `/media/${versions[0]}`)
        .set(await headers())
        .expect(409);
      await api('delete', `/media/${versions[1]}`)
        .set(await headers())
        .expect(200);
      await api('delete', `/media/${versions[0]}`)
        .set(await headers())
        .expect(200);
    });

    it('applies current variant authorization to product files without hiding unrestricted documents for products with no SKU', async () => {
      const products: Array<{ id: string; variants: Array<{ id: string }> }> = [];
      for (const name of ['linked', 'other', 'no-sku']) {
        products.push(
          await prisma.product.create({
            data: {
              name: `Media authorization ${name}`,
              slug: `media-authorization-${name}-${suffix}`,
              status: 'ACTIVE',
              ...(name !== 'no-sku'
                ? { variants: { create: { sku: `MEDIA-${name}-${suffix}` } } }
                : {}),
            },
            include: { variants: true },
          }),
        );
      }
      try {
        const uploaded = await api('post', '/media/upload')
          .set(await headers())
          .field('visibility', 'DEALER_ONLY')
          .attach(
            'file',
            Buffer.from(`%PDF-1.7\n% restricted SKU ${suffix}\n%%EOF`),
            'authorized-product.pdf',
          )
          .expect(201);
        const id = uploaded.body.data.id;
        assetIds.push(id);
        const metadataHeaders = await headers();
        const link = (productId: string) =>
          api('patch', `/media/${id}/metadata`)
            .set(metadataHeaders)
            .send({
              alt: 'Authorized product manual',
              usageLocations: [],
              companyIds: [],
              productIds: [productId],
            });
        await link(products[0].id).expect(200);
        const policy = (index: number, variantIds?: string[]) =>
          prisma.dealerCompany.update({
            where: { id: companyIds[index] },
            data: { catalogPolicy: variantIds ? { variantIds } : {} },
          });
        const listed = async (token: string) =>
          (
            await api(
              'get',
              '/media/downloads?productId=' + products[0].id,
              token,
            ).expect(200)
          ).body.data.some((file: { id: string }) => file.id === id);
        for (const denied of [[], [products[1].variants[0].id]]) {
          await policy(0, denied);
          await api('get', `/media/${id}/access`, dealerA).expect(403);
          expect(await listed(dealerA)).toBe(false);
        }
        await policy(0, [products[0].variants[0].id]);
        await policy(1, [products[1].variants[0].id]);
        const signed = await api('get', `/media/${id}/access`, dealerA).expect(
          200,
        );
        expect(await listed(dealerA)).toBe(true);
        await request(app.getHttpServer())
          .get('/api/v1' + signed.body.data.url)
          .expect(200);
        await api('get', `/media/${id}/access`, dealerB).expect(403);
        expect(await listed(dealerB)).toBe(false);
        await prisma.productVariant.update({
          where: { id: products[0].variants[0].id },
          data: { status: false },
        });
        await api('get', `/media/${id}/access`, dealerA).expect(403);
        expect(await listed(dealerA)).toBe(false);
        await policy(0);
        await link(products[2].id).expect(200);
        await api('get', `/media/${id}/access`, dealerA).expect(200);
        await policy(0, []);
        await api('get', `/media/${id}/access`, dealerA).expect(403);
      } finally {
        await prisma.dealerCompany.updateMany({
          where: { id: { in: companyIds } },
          data: { catalogPolicy: {} },
        });
        await prisma.product.deleteMany({
          where: { id: { in: products.map((p) => p.id) } },
        });
      }
    });
  },
);

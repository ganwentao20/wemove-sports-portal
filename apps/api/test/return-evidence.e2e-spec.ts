import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { authenticatedFixture } from './auth-session.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Private retail return evidence (DB, images and signed file access)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID();
    let app: INestApplication,
      owner = '',
      outsider = '',
      staff = '',
      limited = '',
      orderId = '',
      lineId = '',
      userId = '',
      png: Buffer;
    const users: string[] = [],
      staffIds: string[] = [],
      mediaIds: string[] = [];
    const api = (
      method: 'get' | 'post' | 'delete',
      path: string,
      token = owner,
    ) =>
      request(app.getHttpServer())
        [method]('/api/v1' + path)
        .set('Authorization', 'Bearer ' + token);
    beforeAll(async () => {
      app = (
        await Test.createTestingModule({ imports: [AppModule] }).compile()
      ).createNestApplication();
      await setupApp(app);
      await app.init();
      const jwt = app.get(JwtService);
      for (const role of ['owner', 'outsider']) {
        const user = await prisma.user.create({
          data: {
            email: `return-${role}-${suffix}@example.test`,
            name: role,
            passwordHash: 'unused',
            status: 'ACTIVE',
            ageConfirmed: true,
          },
        });
        users.push(user.id);
        const token = await authenticatedFixture(prisma, jwt, user, 'customer');
        if (role === 'owner') {
          owner = token;
          userId = user.id;
        } else outsider = token;
      }
      const superRole = await prisma.role.upsert({
        where: { code: 'SUPER_ADMIN' },
        create: { code: 'SUPER_ADMIN', name: 'Super admin' },
        update: {},
      });
      for (const allowed of [true, false]) {
        const person = await prisma.staff.create({
          data: {
            email: `return-staff-${allowed}-${suffix}@example.test`,
            name: 'Support',
            passwordHash: 'unused',
            mfaEnabled: true,
            mfaSecret: 'unused',
            ...(allowed ? { roles: { create: { roleId: superRole.id } } } : {}),
          },
        });
        staffIds.push(person.id);
        const token = await authenticatedFixture(prisma, jwt, person, 'staff');
        if (allowed) staff = token;
        else limited = token;
      }
      const order = await prisma.order.create({
        data: {
          orderNo: `return-${suffix}`,
          userId,
          status: 'FULFILLED',
          subtotalCents: 3000,
          totalCents: 3000,
          paymentStatus: 'PAID',
          items: {
            create: {
              productName: 'Returned product',
              sku: 'RETURN-PHOTO',
              quantity: 3,
              shippedQuantity: 3,
              unitPriceCents: 1000,
              lineCents: 3000,
            },
          },
        },
        include: { items: true },
      });
      orderId = order.id;
      lineId = order.items[0].id;
      png = await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 3,
          background: { r: 60, g: 140, b: 210 },
        },
      })
        .png()
        .toBuffer();
    });
    afterAll(async () => {
      await app?.close();
      await prisma.retailReturn.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
      const assets = await prisma.mediaAsset.findMany({
        where: { id: { in: mediaIds } },
      });
      for (const asset of assets)
        await unlink(join(process.cwd(), 'media_private', asset.key)).catch(
          () => {},
        );
      await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
      await prisma.siteSetting.deleteMany({
        where: { key: { in: mediaIds.map((id) => `media-cleanup:${id}`) } },
      });
      await prisma.accountPrivacyRequest.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [...users, ...staffIds] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
      await prisma.$disconnect();
    });
    async function upload() {
      const r = await api('post', `/orders/${orderId}/return-attachments`)
        .attach('file', png, {
          filename: 'damage.png',
          contentType: 'image/png',
        })
        .expect(201);
      mediaIds.push(r.body.data.mediaId);
      return r.body.data as {
        mediaId: string;
        attachmentToken: string;
        fileName: string;
      };
    }
    it('rejects other customers, staff customer endpoints and disguised image bytes', async () => {
      await api('post', `/orders/${orderId}/return-attachments`)
        .attach('file', png, {
          filename: 'damage.html',
          contentType: 'image/png',
        })
        .expect(400);
      await api('post', `/orders/${orderId}/return-attachments`, outsider)
        .attach('file', png, {
          filename: 'damage.png',
          contentType: 'image/png',
        })
        .expect(404);
      await api('post', `/orders/${orderId}/return-attachments`, staff)
        .attach('file', png, {
          filename: 'damage.png',
          contentType: 'image/png',
        })
        .expect(403);
      await api('post', `/orders/${orderId}/return-attachments`)
        .attach('file', Buffer.from('not a PNG'), {
          filename: 'damage.png',
          contentType: 'image/png',
        })
        .expect(422);
    });
    it('validates ownership, line, scan status and capability before preserving private evidence', async () => {
      const image = await upload(),
        dto = {
          reason: 'Damaged item',
          description: 'Outer parcel arrived intact.',
          items: [
            {
              orderItemId: lineId,
              quantity: 1,
              description: 'The edge is damaged.',
            },
          ],
          attachments: [
            {
              mediaId: image.mediaId,
              attachmentToken: image.attachmentToken,
              orderItemId: lineId,
            },
          ],
        };
      await api('post', `/orders/${orderId}/returns`)
        .send({
          ...dto,
          attachments: [
            { ...dto.attachments[0], attachmentToken: 'not-the-capability' },
          ],
        })
        .expect(400);
      await api('post', `/orders/${orderId}/returns`)
        .send({
          ...dto,
          attachments: [
            { ...dto.attachments[0], orderItemId: 'different-order-line' },
          ],
        })
        .expect(400);
      await prisma.mediaAsset.update({
        where: { id: image.mediaId },
        data: { scanStatus: 'PENDING_DELETE' },
      });
      await api('post', `/orders/${orderId}/returns`).send(dto).expect(400);
      await prisma.mediaAsset.update({
        where: { id: image.mediaId },
        data: { scanStatus: 'CLEAN' },
      });
      const saved = await api('post', `/orders/${orderId}/returns`)
          .send(dto)
          .expect(201),
        returnId = saved.body.data.id;
      expect(saved.body.data).toMatchObject({
        description: dto.description,
        items: dto.items,
        attachments: [
          {
            mediaId: image.mediaId,
            orderItemId: lineId,
            fileName: 'damage.png',
          },
        ],
      });
      expect(JSON.stringify(saved.body.data)).not.toContain(
        image.attachmentToken,
      );
      await api('get', `/media/${image.mediaId}/download`).expect(403);
      await api('get', `/media/${image.mediaId}/access`).expect(403);
      const path = `/orders/${orderId}/returns/${returnId}/attachments/${image.mediaId}/access`;
      await api('get', path, outsider).expect(404);
      await api('get', '/admin/commerce' + path, limited).expect(403);
      await api('get', '/admin/commerce' + path, staff).expect(200);
      const signed = await api('get', path).expect(200);
      const contents = await request(app.getHttpServer())
        .get('/api/v1' + signed.body.data.url)
        .expect(200);
      expect(Buffer.compare(contents.body, png)).toBe(0);
      await api(
        'delete',
        `/orders/${orderId}/return-attachments/${image.mediaId}`,
      ).expect(400);
      const exported = await api('get', '/account/export').expect(200);
      expect(exported.body.data.afterSales.retailReturns).toEqual([
        expect.objectContaining({
          description: dto.description,
          attachments: saved.body.data.attachments,
        }),
      ]);
    });
    it('lets only the owner remove unsubmitted images and immediately disables signing', async () => {
      const image = await upload();
      await api(
        'delete',
        `/orders/${orderId}/return-attachments/${image.mediaId}`,
        outsider,
      ).expect(404);
      await api(
        'delete',
        `/orders/${orderId}/return-attachments/${image.mediaId}`,
      ).expect(200);
      expect(
        await prisma.mediaAsset.findUnique({ where: { id: image.mediaId } }),
      ).toMatchObject({ scanStatus: 'PENDING_DELETE', usageLocations: [] });
      expect(
        await prisma.siteSetting.findUnique({
          where: { key: `media-cleanup:${image.mediaId}` },
        }),
      ).toBeTruthy();
      await api('post', `/orders/${orderId}/returns`)
        .send({
          reason: 'Changed evidence',
          items: [{ orderItemId: lineId, quantity: 1 }],
          attachments: [{ ...image, orderItemId: lineId }],
        })
        .expect(400);
    });
  },
);

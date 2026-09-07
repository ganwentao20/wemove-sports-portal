import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { authenticatedFixture } from './auth-session.js';
describe.skipIf(process.env.E2E_DB !== '1')(
  'Product resource discovery (DB)',
  () => {
    const prisma = new PrismaClient(),
      key = randomUUID(),
      product = 'resource-product-' + key;
    let app: INestApplication,
      userId = '',
      token = '';
    const ids: string[] = [];
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      await setupApp(app);
      await app.init();
      const user = await prisma.user.create({
        data: {
          email: key + '@example.test',
          name: 'Resource reader',
          passwordHash: 'unused',
          status: 'ACTIVE',
          ageConfirmed: true,
        },
      });
      userId = user.id;
      token = await authenticatedFixture(
        prisma,
        app.get(JwtService),
        user,
        'customer',
      );
      for (const [index, visibility] of [
        'PUBLIC',
        'REGISTERED',
        'DEALER_ONLY',
        'PUBLIC',
        'PUBLIC',
      ].entries()) {
        const asset = await prisma.mediaAsset.create({
          data: {
            key: key + '-' + index,
            fileName: 'resource-' + index + '.pdf',
            title: 'Product resource ' + index,
            mimeType: 'application/pdf',
            sizeBytes: 20,
            visibility: visibility as 'PUBLIC' | 'REGISTERED' | 'DEALER_ONLY',
            scanStatus: 'CLEAN',
            productIds: [index === 3 ? 'another-product' : product],
            publishedAt: new Date(Date.now() + (index === 4 ? 3600000 : -1000)),
          },
        });
        ids.push(asset.id);
      }
    });
    afterAll(async () => {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: ids } } });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: userId },
      });
      if (userId) await prisma.user.delete({ where: { id: userId } });
      await app?.close();
      await prisma.$disconnect();
    });
    it('returns only published public resources related to the selected product', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/media/public?productId=' + product)
        .expect(200);
      expect(response.body.data.map((row: { id: string }) => row.id)).toEqual([
        ids[0],
      ]);
      await request(app.getHttpServer())
        .get('/api/v1/media/downloads?productId=' + product)
        .expect(401);
    });
    it('adds registered resources only for authenticated customers and never exposes dealer files', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/media/downloads?productId=' + product)
        .set('Authorization', 'Bearer ' + token)
        .expect(200);
      expect(
        response.body.data.map((row: { id: string }) => row.id).sort(),
      ).toEqual(ids.slice(0, 2).sort());
      expect(JSON.stringify(response.body)).not.toContain(ids[2]);
      await request(app.getHttpServer())
        .get('/api/v1/media/' + ids[2] + '/access')
        .set('Authorization', 'Bearer ' + token)
        .expect(403);
    });
  },
);

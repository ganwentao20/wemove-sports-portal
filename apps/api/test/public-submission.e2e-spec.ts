import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Concurrent public submissions and subscription consent (DB)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID();
    const email = `public-safety-${suffix}@example.test`,
      token = '1'.repeat(64);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const outboxKeys: string[] = [];
    let app: INestApplication;
    beforeAll(async () => {
      const fixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = fixture.createNestApplication();
      await setupApp(app);
      await app.init();
    });
    afterAll(async () => {
      const contacts = await prisma.contactMessage.findMany({
        where: { email },
        select: { id: true },
      });
      outboxKeys.push(...contacts.map((item) => `contact.received:${item.id}`));
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: contacts.map((item) => item.id) } },
      });
      await prisma.contactMessage.deleteMany({ where: { email } });
      await prisma.newsletterSubscription.deleteMany({ where: { email } });
      await prisma.notificationOutbox.deleteMany({
        where: {
          OR: outboxKeys.map((key) => ({ dedupeKey: { startsWith: key } })),
        },
      });
      await app?.close();
      await prisma.$disconnect();
    });
    const post = (path: string) =>
      request(app.getHttpServer()).post(`/api/v1${path}`);
    const subscription = {
      email,
      locale: 'en',
      consent: true,
      consentVersion: 'privacy-2026-09',
    };
    it('keeps one confirmation token/outbox under concurrent repeated subscribe and never demotes ACTIVE', async () => {
      const responses = await Promise.all([
        post('/newsletter').send(subscription),
        post('/newsletter').send(subscription),
      ]);
      responses.forEach((response) => expect(response.status).toBe(201));
      const first = await prisma.newsletterSubscription.findUniqueOrThrow({
        where: { email },
      });
      const key = `newsletter:${first.tokenHash}`;
      outboxKeys.push(key);
      expect(
        await prisma.notificationOutbox.count({ where: { dedupeKey: key } }),
      ).toBe(1);
      await post('/newsletter').send(subscription).expect(201);
      expect(
        (
          await prisma.newsletterSubscription.findUniqueOrThrow({
            where: { email },
          })
        ).tokenHash,
      ).toBe(first.tokenHash);
      await prisma.newsletterSubscription.update({
        where: { email },
        data: { status: 'ACTIVE', tokenHash },
      });
      await post('/newsletter').send(subscription).expect(201);
      expect(
        await prisma.newsletterSubscription.findUnique({ where: { email } }),
      ).toMatchObject({ status: 'ACTIVE', tokenHash });
    });
    it('preserves unsubscribe and refuses old confirmation replay until a new explicit subscription', async () => {
      outboxKeys.push(`newsletter-unsubscribe:${tokenHash}`);
      await post('/newsletter/unsubscribe').send({ token }).expect(201);
      await post('/newsletter/unsubscribe').send({ token }).expect(201);
      await post('/newsletter/confirm').send({ token }).expect(404);
      expect(
        await prisma.newsletterSubscription.findUnique({ where: { email } }),
      ).toMatchObject({ status: 'UNSUBSCRIBED' });
      expect(
        await prisma.notificationOutbox.count({
          where: { dedupeKey: `newsletter-unsubscribe:${tokenHash}` },
        }),
      ).toBe(1);
      await post('/newsletter').send(subscription).expect(201);
      const fresh = await prisma.newsletterSubscription.findUniqueOrThrow({
        where: { email },
      });
      outboxKeys.push(`newsletter:${fresh.tokenHash}`);
      expect(fresh.status).toBe('PENDING');
      expect(fresh.tokenHash).not.toBe(tokenHash);
      await post('/newsletter/unsubscribe').send({ token }).expect(404);
    });
    it('serializes contact retries, sends one receipt, and rejects reusing a key with a different message', async () => {
      const input = {
        name: 'Submission tester',
        email,
        subject: 'Duplicate request test',
        content: 'Please help with this original support request.',
        consent: true,
        consentVersion: 'privacy-2026-09',
        submissionKey: randomUUID(),
      };
      const responses = await Promise.all([
        post('/contacts').send(input),
        post('/contacts').send(input),
      ]);
      responses.forEach((response) => expect(response.status).toBe(201));
      expect(responses[0].body.data.id).toBe(responses[1].body.data.id);
      await post('/contacts')
        .send({
          ...input,
          content: 'A changed message must require a different submission key.',
        })
        .expect(409);
      const { submissionKey: _submissionKey, ...legacy } = input;
      const retry = await post('/contacts').send(legacy).expect(201);
      expect(retry.body.data.id).toBe(responses[0].body.data.id);
      expect(await prisma.contactMessage.count({ where: { email } })).toBe(1);
      expect(
        await prisma.notificationOutbox.count({
          where: { dedupeKey: `contact.received:${retry.body.data.id}` },
        }),
      ).toBe(1);
    });
  },
);

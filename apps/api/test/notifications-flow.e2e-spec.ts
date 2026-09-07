import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, type Prisma } from '@prisma/client';
import { generate, generateSecret } from 'otplib';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { authenticatedFixture } from './auth-session.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Notification templates and real SMTP delivery (DB)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID().slice(0, 8),
      secret = generateSecret();
    const accepted: Array<{ recipients: string[]; raw: string }> = [];
    let smtp: Server,
      app: INestApplication,
      service: NotificationsService,
      staff = '',
      customer = '',
      staffId = '',
      userId = '',
      failNext = false;
    const email = `notify-user-${suffix}@example.test`,
      operator = `notify-operator-${suffix}@example.test`;
    let priorSettings: Array<{ key: string; value: Prisma.JsonValue }> = [];
    const api = (method: 'get' | 'post' | 'put', path: string, token = staff) =>
      request(app.getHttpServer())
        [method](`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`);
    const mfa = async () => ({ 'x-mfa-code': await generate({ secret }) });
    const input = (key: string) => ({
      kind: 'test.notice',
      to: email,
      subject: 'Notification test',
      text: 'Private test details',
      dedupeKey: `notify-${suffix}-${key}`,
      internalGroup: false as const,
    });
    const template = (text: string) => ({
      kind: 'test.notice',
      locales: {
        en: { subject: 'Notice for {{name}}', text },
        zh: { subject: '{{name}} 的通知', text },
      },
    });

    beforeAll(async () => {
      vi.stubEnv('NOTIFICATION_WORKER', 'false');
      vi.stubEnv('SMTP_SECURE', 'false');
      vi.stubEnv('SMTP_USER', '');
      vi.stubEnv('SMTP_PASS', 'not-exposed-to-browser');
      smtp = createServer((socket) => {
        let buffer = '',
          data = false,
          raw = '',
          recipients: string[] = [];
        socket.write('220 local.test ESMTP ready\r\n');
        socket.on('data', (chunk) => {
          buffer += chunk.toString();
          let end: number;
          while ((end = buffer.indexOf('\r\n')) >= 0) {
            const line = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (data) {
              if (line === '.') {
                data = false;
                if (failNext) {
                  failNext = false;
                  socket.write('451 Try again later\r\n');
                } else {
                  accepted.push({ recipients: [...recipients], raw });
                  socket.write('250 Message accepted\r\n');
                }
                raw = '';
                recipients = [];
              } else raw += line.replace(/^\.\./, '.') + '\r\n';
            } else if (/^(EHLO|HELO)/i.test(line))
              socket.write('250-local.test\r\n250 8BITMIME\r\n');
            else if (/^RCPT TO:/i.test(line)) {
              recipients.push(line.slice(8).trim());
              socket.write('250 Recipient accepted\r\n');
            } else if (/^DATA$/i.test(line)) {
              data = true;
              socket.write('354 Send message\r\n');
            } else if (/^QUIT$/i.test(line)) socket.end('221 Goodbye\r\n');
            else socket.write('250 OK\r\n');
          }
        });
      });
      await new Promise<void>((resolve) =>
        smtp.listen(0, '127.0.0.1', resolve),
      );
      const address = smtp.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing SMTP port');
      vi.stubEnv('SMTP_HOST', '127.0.0.1');
      vi.stubEnv('SMTP_PORT', String(address.port));
      priorSettings = await prisma.siteSetting.findMany({
        where: { key: { in: ['notificationTemplates', 'notifications'] } },
      });
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      await setupApp(app);
      await app.init();
      service = app.get(NotificationsService);
      const jwt = app.get(JwtService),
        role = await prisma.role.upsert({
          where: { code: 'SUPER_ADMIN' },
          create: { code: 'SUPER_ADMIN', name: 'Super Admin' },
          update: {},
        });
      const admin = await prisma.staff.create({
        data: {
          email: `notify-admin-${suffix}@example.test`,
          name: 'Notification operator',
          passwordHash: 'unused',
          mfaEnabled: true,
          mfaSecret: secret,
          roles: { create: { roleId: role.id } },
        },
      });
      staffId = admin.id;
      staff = await authenticatedFixture(prisma, jwt, admin, 'staff');
      const user = await prisma.user.create({
        data: {
          email,
          name: '<Alex & Sam>',
          passwordHash: 'unused',
          status: 'ACTIVE',
          locale: 'zh-CN',
          marketingEmail: false,
          ageConfirmed: true,
        },
      });
      userId = user.id;
      customer = await authenticatedFixture(prisma, jwt, user, 'customer');
    });
    afterAll(async () => {
      await prisma.siteSetting.deleteMany({
        where: { key: { in: ['notificationTemplates', 'notifications'] } },
      });
      for (const setting of priorSettings)
        await prisma.siteSetting.create({
          data: {
            key: setting.key,
            value: setting.value as Prisma.InputJsonValue,
          },
        });
      await prisma.notificationOutbox.deleteMany({
        where: { dedupeKey: { startsWith: `notify-${suffix}` } },
      });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [userId, staffId] } },
      });
      if (userId) await prisma.user.delete({ where: { id: userId } });
      if (staffId) await prisma.staff.delete({ where: { id: staffId } });
      await app?.close();
      await prisma.$disconnect();
      if (smtp)
        await new Promise<void>((resolve) => smtp.close(() => resolve()));
      vi.unstubAllEnvs();
    });

    it('requires settings permission and MFA, validates placeholders, selects account language and escapes HTML variables', async () => {
      await api('get', '/admin/notifications/templates', customer).expect(403);
      await api('put', '/admin/notifications/templates')
        .send({ templates: [template('{{name}}')] })
        .expect(403);
      await api('put', '/admin/notifications/templates')
        .set(await mfa())
        .send({ templates: [template('{{broken')] })
        .expect(400);
      const result = await api('put', '/admin/notifications/templates')
        .set(await mfa())
        .send({ templates: [template('Reference {{reference}}')] })
        .expect(200);
      expect(JSON.stringify(result.body)).not.toContain(
        'not-exposed-to-browser',
      );
      const preview = await api('post', '/admin/notifications/preview')
        .send({
          kind: 'test.notice',
          to: email,
          subject: 'Test',
          text: 'Test text',
          variables: { reference: 'WM-1001' },
        })
        .expect(201);
      expect(preview.body.data).toMatchObject({
        locale: 'zh',
        requestedLocale: 'zh-cn',
        fallback: true,
        subject: '<Alex & Sam> 的通知',
        text: 'Reference WM-1001',
      });
      const escaped = await service.preview(input('escape'), {
        subject: '{{name}}',
        text: '{{name}}',
        html: '<p>{{name}}</p>',
      });
      expect(escaped.html).toBe('<p>&lt;Alex &amp; Sam&gt;</p>');
      const password = await service.preview({
        ...input('transaction'),
        kind: 'account.password-reset',
        text: 'Reset: https://example.test/reset?token=secret',
      });
      expect(password.text).toContain('请在一小时内');
    });

    it('records missing variables without sending, allows retry after template correction and never duplicates a sent event', async () => {
      const queued = await service.enqueue(input('missing'));
      let row = await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: queued.id },
      });
      expect(row).toMatchObject({
        status: 'DEAD',
        attempts: 0,
        lastError: 'TEMPLATE_MISSING_VARIABLE:reference',
      });
      expect(row.payload).not.toContain(email);
      expect(row.payload).not.toContain('Private test details');
      await service.deliver(row.id);
      expect(accepted).toHaveLength(0);
      expect(await service.retry(row.id)).toEqual({ count: 0 });
      await api('put', '/admin/notifications/templates')
        .set(await mfa())
        .send({ templates: [template('{{name}}: {{text}}')] })
        .expect(200);
      expect(await service.retry(row.id)).toEqual({ count: 1 });
      await service.deliver(row.id);
      row = await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: queued.id },
      });
      expect(row).toMatchObject({ status: 'SENT', payload: '', attempts: 1 });
      expect(accepted).toHaveLength(1);
      expect((await service.enqueue(input('missing'))).id).toBe(row.id);
      await service.deliver(row.id);
      expect(accepted).toHaveLength(1);
    });

    it('delivers separate internal group messages and excludes customer claim tokens', async () => {
      await api('put', '/admin/notifications/groups')
        .set(await mfa())
        .send({ dealer: [operator, operator], support: [], orders: [] })
        .expect(200);
      const message = {
        ...input('internal'),
        kind: 'dealer.application.confirmation',
        internalGroup: undefined,
        text: 'Claim your application: https://example.test/application#claim=SECRET_CLAIM_ONLY_FOR_CUSTOMER',
      };
      const queued = await service.enqueue(message);
      const rows = await prisma.notificationOutbox.findMany({
        where: { dedupeKey: { startsWith: message.dedupeKey } },
      });
      expect(rows).toHaveLength(2);
      for (const row of rows) await service.deliver(row.id);
      const sentToOperator = accepted.filter((item) =>
        item.recipients.some((to) => to.includes(operator)),
      );
      expect(sentToOperator).toHaveLength(1);
      expect(sentToOperator[0].raw).not.toContain('SECRET_CLAIM');
      expect(sentToOperator[0].raw).toContain(queued.id);
      expect(sentToOperator[0].raw).toContain('/admin/dealers');
    });

    it('deduplicates concurrent producer events without losing a successful business response', async () => {
      const event = input('concurrent-producer');
      const rows = await Promise.all(
        Array.from({ length: 6 }, () => service.enqueue(event)),
      );
      expect(new Set(rows.map((row) => row.id)).size).toBe(1);
      expect(
        await prisma.notificationOutbox.count({
          where: { dedupeKey: event.dedupeKey },
        }),
      ).toBe(1);
      const txEvent = input('concurrent-transaction-producer');
      const txRows = await Promise.all([
        prisma.$transaction((tx) => service.enqueue(txEvent, tx)),
        prisma.$transaction((tx) => service.enqueue(txEvent, tx)),
      ]);
      expect(txRows[0].id).toBe(txRows[1].id);
    });
    it('keeps outbox validation and insertion inside its caller transaction and rolls back atomically', async () => {
      const rollback = input('transaction-rollback');
      await expect(
        prisma.$transaction(async (tx) => {
          const pending = await service.enqueue(rollback, tx);
          expect(
            await tx.notificationOutbox.findUnique({
              where: { id: pending.id },
            }),
          ).not.toBeNull();
          throw new Error('rollback source mutation');
        }),
      ).rejects.toThrow('rollback source mutation');
      expect(
        await prisma.notificationOutbox.findUnique({
          where: { dedupeKey: rollback.dedupeKey },
        }),
      ).toBeNull();
      const committed = input('transaction-commit');
      const globalReads = [
        vi.spyOn(
          (service as unknown as { prisma: PrismaClient }).prisma.siteSetting,
          'findMany',
        ),
        vi.spyOn(
          (service as unknown as { prisma: PrismaClient }).prisma.user,
          'findUnique',
        ),
        vi.spyOn(
          (service as unknown as { prisma: PrismaClient }).prisma
            .newsletterSubscription,
          'findUnique',
        ),
      ];
      try {
        await prisma.$transaction(async (tx) => {
          await service.enqueue(committed, tx);
        });
        for (const read of globalReads) expect(read).not.toHaveBeenCalled();
      } finally {
        for (const read of globalReads) read.mockRestore();
      }
      expect(
        await prisma.notificationOutbox.findUnique({
          where: { dedupeKey: committed.dedupeKey },
        }),
      ).toMatchObject({ status: 'PENDING' });
    });

    it('retains failed deliveries with backoff and leases concurrent retry attempts; scheduled mail waits until due', async () => {
      const queued = await service.enqueue({
        ...input('smtp-retry'),
        locale: 'en',
      });
      failNext = true;
      await service.deliver(queued.id);
      let row = await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: queued.id },
      });
      expect(row).toMatchObject({
        status: 'PENDING',
        attempts: 1,
        lastError: 'DELIVERY_FAILED',
      });
      expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
      const count = accepted.length;
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { availableAt: new Date(Date.now() - 1000) },
      });
      await Promise.all([service.deliver(row.id), service.deliver(row.id)]);
      row = await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(row).toMatchObject({ status: 'SENT', attempts: 2 });
      expect(accepted).toHaveLength(count + 1);
      const scheduled = await service.enqueue({
        ...input('later'),
        availableAt: new Date(Date.now() + 60000),
      });
      await service.deliver(scheduled.id);
      expect(
        await prisma.notificationOutbox.findUnique({
          where: { id: scheduled.id },
        }),
      ).toMatchObject({ status: 'PENDING', attempts: 0 });
    });
  },
);

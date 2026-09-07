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
  'Contact triage, protected exports and attachment safety (DB)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID(),
      secret = generateSecret();
    const staffIds: string[] = [],
      roleIds: string[] = [],
      assetIds: string[] = [],
      emails: string[] = [];
    let app: INestApplication,
      jwt: JwtService,
      editorToken = '',
      readerToken = '',
      outsiderToken = '',
      leadId = '';
    const api = (
      method: 'get' | 'post' | 'patch' | 'put',
      path: string,
      token?: string,
    ) => {
      const call = request(app.getHttpServer())[method](`/api/v1${path}`);
      return token ? call.set('Authorization', `Bearer ${token}`) : call;
    };
    async function employee(permissions: string[]) {
      const role = await prisma.role.create({
        data: {
          code: `CONTACT_TEST_${randomUUID()}`,
          name: 'Contact acceptance',
        },
      });
      roleIds.push(role.id);
      for (const code of permissions) {
        const permission = await prisma.permission.upsert({
          where: { code },
          create: { code, name: code, group: 'contact' },
          update: {},
        });
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
      const staff = await prisma.staff.create({
        data: {
          email: `contact-staff-${staffIds.length}-${suffix}@example.test`,
          name: 'Contact test staff',
          passwordHash: 'not-a-login-password',
          mfaEnabled: true,
          mfaSecret: secret,
          roles: { create: { roleId: role.id } },
        },
      });
      staffIds.push(staff.id);
      return authenticatedFixture(prisma, jwt, staff, 'staff');
    }
    beforeAll(async () => {
      const fixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = fixture.createNestApplication();
      await setupApp(app);
      await app.init();
      jwt = app.get(JwtService);
      editorToken = await employee(['contact:read', 'contact:write']);
      readerToken = await employee(['contact:read']);
      outsiderToken = await employee([]);
      const email = `contact-triage-${suffix}@example.test`;
      emails.push(email);
      for (let i = 0; i < 23; i++) {
        const lead = await prisma.contactMessage.create({
          data: {
            email,
            name: 'Confidential name',
            subject: `${suffix} request ${i}`,
            content: 'Confidential message text',
            source: i < 22 ? 'ORDER_SUPPORT' : 'CONTACT',
            priority: i < 22 ? 'HIGH' : 'LOW',
            tags: ['Existing tag'],
            assignedTo: staffIds[0],
            assignedTeam: 'Support',
          },
        });
        if (i === 0) leadId = lead.id;
      }
    });
    afterAll(async () => {
      const leads = await prisma.contactMessage.findMany({
          where: { email: { in: emails } },
          select: { id: true },
        }),
        ids = leads.map((lead) => lead.id);
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ entityId: { in: ids } }, { actorStaffId: { in: staffIds } }],
        },
      });
      await prisma.notificationOutbox.deleteMany({
        where: {
          OR: ids.flatMap((id) =>
            ['contact.received', 'contact.status', 'contact.reply'].map(
              (kind) => ({ dedupeKey: { startsWith: `${kind}:${id}` } }),
            ),
          ),
        },
      });
      await prisma.contactMessage.deleteMany({ where: { id: { in: ids } } });
      await prisma.mediaAsset.deleteMany({ where: { id: { in: assetIds } } });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: staffIds } },
      });
      await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      await app?.close();
      await prisma.$disconnect();
    });
    it('filters case-insensitive search, priority/source/team and paginates with a stable total', async () => {
      const query = {
        search: suffix.toUpperCase(),
        priority: 'HIGH',
        source: 'ORDER_SUPPORT',
        assignedTeam: 'support',
        pageSize: 20,
      };
      const first = await api('get', '/contacts', readerToken)
          .query(query)
          .expect(200),
        second = await api('get', '/contacts', readerToken)
          .query({ ...query, page: 2 })
          .expect(200);
      expect(first.body.data).toMatchObject({
        total: 22,
        page: 1,
        pageSize: 20,
      });
      expect(first.body.data.items).toHaveLength(20);
      expect(second.body.data.items).toHaveLength(2);
      expect(
        new Set(
          [...first.body.data.items, ...second.body.data.items].map(
            (row) => row.id,
          ),
        ).size,
      ).toBe(22);
      await api('get', '/contacts', readerToken)
        .query({ pageSize: 101 })
        .expect(400);
      await api('get', '/contacts', readerToken)
        .query({ status: 'UNKNOWN' })
        .expect(400);
    });
    it('exports all filtered rows with fresh MFA, omits personal/internal details and records the export', async () => {
      await api('get', '/contacts/export', readerToken)
        .query({ search: suffix })
        .expect(403);
      const result = await api('get', '/contacts/export', readerToken)
        .query({
          search: suffix,
          priority: 'HIGH',
          source: 'ORDER_SUPPORT',
          pageSize: 1,
        })
        .set('x-mfa-code', await generate({ secret }))
        .expect(200);
      expect(result.headers['content-type']).toContain('text/csv');
      expect(result.text.trim().split(/\r?\n/)).toHaveLength(23);
      expect(result.text).toContain('assignedTeam');
      expect(result.text).not.toContain('Confidential name');
      expect(result.text).not.toContain('Confidential message text');
      expect(result.text).not.toContain(emails[0]);
      expect(
        await prisma.auditLog.findFirst({
          where: { actorStaffId: staffIds[1], action: 'contact.export' },
        }),
      ).toBeTruthy();
    });
    it('enforces read/write permissions independently of knowing the inbox route', async () => {
      await api('get', '/contacts').expect(401);
      await api('get', '/contacts', outsiderToken).expect(403);
      await api('get', '/contacts/export', outsiderToken)
        .set('x-mfa-code', await generate({ secret }))
        .expect(403);
      await api('patch', `/contacts/${leadId}`, readerToken)
        .set('x-mfa-code', await generate({ secret }))
        .send({ priority: 'LOW' })
        .expect(403);
    });
    it('preserves unrelated triage values and records assignment, state history and resolution time correctly', async () => {
      const updated = await api('patch', `/contacts/${leadId}`, editorToken)
        .set('x-mfa-code', await generate({ secret }))
        .send({ assignedTeam: ' Returns ', status: 'ASSIGNED' })
        .expect(200);
      expect(updated.body.data).toMatchObject({
        priority: 'HIGH',
        assignedTo: staffIds[0],
        assignedTeam: 'Returns',
        tags: ['Existing tag'],
        handledAt: null,
      });
      await api('put', `/contacts/${leadId}/status`, editorToken)
        .set('x-mfa-code', await generate({ secret }))
        .send({ status: 'WAITING_CUSTOMER' })
        .expect(200);
      await api('put', `/contacts/${leadId}/status`, editorToken)
        .set('x-mfa-code', await generate({ secret }))
        .send({ status: 'RESOLVED' })
        .expect(200);
      let lead = await prisma.contactMessage.findUniqueOrThrow({
        where: { id: leadId },
      });
      expect(lead.handledAt).not.toBeNull();
      expect(lead.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ changes: { status: 'WAITING_CUSTOMER' } }),
        ]),
      );
      await api('put', `/contacts/${leadId}/status`, editorToken)
        .set('x-mfa-code', await generate({ secret }))
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      lead = await prisma.contactMessage.findUniqueOrThrow({
        where: { id: leadId },
      });
      expect(lead.handledAt).toBeNull();
      expect(
        await prisma.notificationOutbox.count({
          where: { dedupeKey: { startsWith: `contact.status:${leadId}:` } },
        }),
      ).toBe(4);
    });
    it('keeps internal notes private and enqueues replies with their saved history', async () => {
      await api('post', `/contacts/${leadId}/replies`, editorToken)
        .set('x-mfa-code', await generate({ secret }))
        .send({ text: 'Internal handling note', internal: true })
        .expect(201);
      expect(
        await prisma.notificationOutbox.count({
          where: { dedupeKey: { startsWith: `contact.reply:${leadId}:` } },
        }),
      ).toBe(0);
      await api('post', `/contacts/${leadId}/replies`, editorToken)
        .set('x-mfa-code', await generate({ secret }))
        .send({ text: 'Customer visible response', internal: false })
        .expect(201);
      expect(
        await prisma.notificationOutbox.count({
          where: { dedupeKey: { startsWith: `contact.reply:${leadId}:` } },
        }),
      ).toBe(1);
    });
    it('rejects pending deletion and unscanned attachments, accepting CLEAN only when scanning is required', async () => {
      const original = process.env.MEDIA_SCAN_REQUIRED;
      try {
        process.env.MEDIA_SCAN_REQUIRED = 'true';
        for (const status of [
          'PENDING_DELETE',
          'QUARANTINED',
          'SIGNATURE_CHECKED',
          'CLEAN',
        ]) {
          const asset = await prisma.mediaAsset.create({
            data: {
              key: `contact-test-${randomUUID()}`,
              fileName: 'acceptance.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 100,
              qualification: true,
              scanStatus: status,
              visibility: 'INTERNAL',
            },
          });
          assetIds.push(asset.id);
          const email = `contact-asset-${status.toLowerCase()}-${suffix}@example.test`;
          emails.push(email);
          const input = {
            name: 'Attachment tester',
            email,
            subject: `${suffix} scanned file`,
            content: 'Please inspect the qualification attachment.',
            consent: true,
            consentVersion: 'privacy-2026-09',
            attachments: [{ mediaId: asset.id, attachmentToken: asset.key }],
          };
          await api('post', '/contacts')
            .send(input)
            .expect(status === 'CLEAN' ? 201 : 400);
        }
      } finally {
        if (original === undefined) delete process.env.MEDIA_SCAN_REQUIRED;
        else process.env.MEDIA_SCAN_REQUIRED = original;
      }
    });
  },
);

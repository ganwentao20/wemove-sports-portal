import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { generate, generateSecret } from 'otplib';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import {
  NotificationsService,
  type NotificationInput,
} from '../src/notifications/notifications.service.js';
import { authenticatedFixture } from './auth-session.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Dealer application and team lifecycle (DB)',
  () => {
    const prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const secret = generateSecret();
    const messages: NotificationInput[] = [];
    const userIds: string[] = [];
    let app: INestApplication,
      owner = '',
      other = '',
      member = '',
      staff = '',
      staffId = '',
      applicationId = '',
      companyId = '';
    const email = `dealer-owner-${suffix}@example.test`;
    const memberEmail = `dealer-member-${suffix}@example.test`;
    const api = (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      path: string,
      token = owner,
    ) =>
      request(app.getHttpServer())
        [method](`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`);
    const dto = {
      companyName: `Lifecycle ${suffix}`,
      legalRegNo: `LIFECYCLE-${suffix}`,
      contactName: 'Company Owner',
      contactEmail: email,
      phone: '+15551234567',
      country: 'US',
      businessType: 'Retailer',
      attachments: [],
      agreementVersion: 'dealer-2026-09',
      agreementsAccepted: true,
    };
    beforeAll(async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(NotificationsService)
        .useValue({
          enqueue: async (input: NotificationInput) => {
            messages.push(input);
            return { id: randomUUID() };
          },
        })
        .compile();
      app = module.createNestApplication();
      await setupApp(app);
      await app.init();
      const jwt = app.get(JwtService);
      async function account(email: string) {
        const user = await prisma.user.create({
          data: {
            email,
            name: 'Lifecycle tester',
            status: 'ACTIVE',
            ageConfirmed: true,
            passwordHash: 'unused',
          },
        });
        userIds.push(user.id);
        return authenticatedFixture(prisma, jwt, user, 'customer');
      }
      owner = await account(email);
      other = await account(`dealer-other-${suffix}@example.test`);
      member = await account(memberEmail);
      const role = await prisma.role.upsert({
        where: { code: 'SUPER_ADMIN' },
        create: { code: 'SUPER_ADMIN', name: 'Super Admin' },
        update: {},
      });
      const admin = await prisma.staff.create({
        data: {
          email: `dealer-admin-${suffix}@example.test`,
          name: 'Lifecycle admin',
          passwordHash: 'unused',
          mfaEnabled: true,
          mfaSecret: secret,
          roles: { create: { roleId: role.id } },
        },
      });
      staffId = admin.id;
      staff = await authenticatedFixture(prisma, jwt, admin, 'staff');
    });
    afterAll(async () => {
      if (applicationId)
        await prisma.dealerApplication.deleteMany({
          where: { id: applicationId },
        });
      if (companyId)
        await prisma.dealerCompany.deleteMany({ where: { id: companyId } });
      await prisma.dealerApplicationDraft.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [...userIds, staffId] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (staffId) await prisma.staff.deleteMany({ where: { id: staffId } });
      await prisma.$disconnect();
      await app?.close();
    });
    it('requires explicit agreement, confirms anonymous application, claims only a matching verified account and closes correction/approval flow', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/dealer/applications')
        .send({ ...dto, agreementsAccepted: false })
        .expect(400);
      const created = await request(app.getHttpServer())
        .post('/api/v1/dealer/applications')
        .send(dto)
        .expect(201);
      applicationId = created.body.data.id;
      expect(created.body.data.claimTokenHash).toBeUndefined();
      const message = messages.find(
        (m) => m.kind === 'dealer.application.confirmation' && m.to === email,
      )!;
      expect(message).toBeDefined();
      let claim = message.text.match(/#claim=([a-f0-9]{64})/)![1];
      await api('post', `/dealer/applications/${applicationId}/claim`, other)
        .send({ token: claim })
        .expect(403);
      await api(
        'post',
        `/dealer/applications/${applicationId}/claim-link`,
        other,
      ).expect(201);
      expect(messages.some((m) => m.kind === 'dealer.application.claim')).toBe(
        false,
      );
      await prisma.dealerApplication.update({
        where: { id: applicationId },
        data: { claimExpiresAt: new Date(Date.now() - 1000) },
      });
      await api(
        'post',
        `/dealer/applications/${applicationId}/claim-link`,
      ).expect(201);
      await api('post', `/dealer/applications/${applicationId}/claim`)
        .send({ token: claim })
        .expect(403);
      claim = messages
        .find((m) => m.kind === 'dealer.application.claim')!
        .text.match(/#claim=([a-f0-9]{64})/)![1];
      await api(
        'post',
        `/dealer/applications/${applicationId}/claim-link`,
      ).expect(201);
      expect(
        messages.filter((m) => m.kind === 'dealer.application.claim'),
      ).toHaveLength(1);

      await api('post', `/dealer/applications/${applicationId}/claim`)
        .send({ token: claim })
        .expect(201);
      await api('post', `/dealer/applications/${applicationId}/claim`)
        .send({ token: claim })
        .expect(403);
      await api(
        'patch',
        `/admin/dealer/applications/${applicationId}/review`,
        staff,
      )
        .set('x-mfa-code', await generate({ secret }))
        .send({
          status: 'MORE_INFO_REQUIRED',
          remark: 'Please correct the contact phone.',
        })
        .expect(200);
      await api('post', `/dealer/applications/${applicationId}/resubmit`, other)
        .send({ ...dto, phone: '+15557654321' })
        .expect(403);
      await api('post', `/dealer/applications/${applicationId}/resubmit`)
        .send({ ...dto, phone: '+15557654321' })
        .expect(201);
      const approved = await api(
        'patch',
        `/admin/dealer/applications/${applicationId}/review`,
        staff,
      )
        .set('x-mfa-code', await generate({ secret }))
        .send({ status: 'APPROVED' })
        .expect(200);
      companyId = approved.body.data.companyId;
      expect(
        await prisma.dealerMember.findUnique({
          where: { companyId_userId: { companyId, userId: userIds[0] } },
        }),
      ).toMatchObject({ role: 'OWNER', active: true });
      expect(
        messages.some(
          (m) =>
            m.kind === 'dealer.application.review' &&
            m.text.includes('APPROVED'),
        ),
      ).toBe(true);
      await api('get', '/dealer/company').expect(403);
      await api('post', '/dealer/terms')
        .send({ accepted: true, version: 'dealer-terms-2026-09' })
        .expect(201);
      await api('get', '/dealer/company').expect(200);
    });
    it('persists drafts only for their owning verified customer', async () => {
      await api('put', '/dealer/application-draft')
        .send({ data: { companyName: 'Saved draft' } })
        .expect(200);
      const saved = await api('get', '/dealer/application-draft').expect(200);
      expect(saved.body.data.data.companyName).toBe('Saved draft');
      const unrelated = await api(
        'get',
        '/dealer/application-draft',
        other,
      ).expect(200);
      expect(unrelated.body.data).toBeNull();
      await api('delete', '/dealer/application-draft').expect(200);
      expect(
        (await api('get', '/dealer/application-draft').expect(200)).body.data,
      ).toBeNull();
    });
    it('maintains headquarters and default address choices with company isolation, and summarizes only this company', async () => {
      const address = {
        label: 'Headquarters',
        kind: 'HEADQUARTERS',
        address: {
          recipient: 'Office',
          phone: '+15555555555',
          country: 'US',
          city: 'Boston',
          addressLine: '20 Corporate Lane',
          postalCode: '02101',
        },
      };
      const hq = await api('post', '/dealer/company/addresses')
        .send(address)
        .expect(201);
      await api('patch', '/dealer/company')
        .send({
          companyName: dto.companyName,
          profile: { defaultShippingAddressId: hq.body.data.id },
        })
        .expect(422);
      const warehouse = await api('post', '/dealer/company/addresses')
        .send({ ...address, kind: 'BOTH', label: 'Warehouse' })
        .expect(201);
      await api('patch', '/dealer/company')
        .send({
          companyName: dto.companyName,
          profile: {
            displayName: 'Lifecycle display',
            taxId: 'TAX-QA',
            defaultShippingAddressId: warehouse.body.data.id,
            defaultBillingAddressId: warehouse.body.data.id,
          },
        })
        .expect(200);
      await api('put', '/dealer/company/addresses/' + warehouse.body.data.id)
        .send({
          ...address,
          label: 'Updated warehouse',
          kind: 'BOTH',
          address: { ...address.address, city: 'Seattle' },
        })
        .expect(200);
      expect(
        (
          await api('get', '/dealer/company').expect(200)
        ).body.data.addresses.find(
          (a: { id: string }) => a.id === warehouse.body.data.id,
        ).address.city,
      ).toBe('Seattle');
      await api('get', '/dealer/dashboard', other).expect(403);
      const dashboard = await api('get', '/dealer/dashboard').expect(200);
      expect(dashboard.body.data.company.id).toBe(companyId);
      expect(dashboard.body.data.counts).toEqual({
        pendingQuotes: 0,
        awaitingReview: 0,
        unpaidOrders: 0,
      });
      expect(dashboard.body.data.orders).toEqual([]);
      await api(
        'delete',
        '/dealer/company/addresses/' + warehouse.body.data.id,
      ).expect(200);
      const company = await prisma.dealerCompany.findUniqueOrThrow({
        where: { id: companyId },
      });
      expect(company.profile).not.toHaveProperty('defaultShippingAddressId');
      expect(company.profile).not.toHaveProperty('defaultBillingAddressId');
      expect(company.profile).toHaveProperty('taxId', 'TAX-QA');
    });
    it('publishes complete dealer details only after staff review, rejects stale reviews and preserves approved content until opt-out', async () => {
      const previous = await prisma.dealerCompany.findUniqueOrThrow({
        where: { id: companyId },
      });
      const profile = {
        ...(previous.profile as Record<string, unknown>),
        publicListing: true,
        publicDetail: true,
        displayName: 'Approved store ' + suffix,
        publicLogo: '/logo.png',
        publicPhone: '+15555550000',
        publicRegion: 'Massachusetts',
        publicPostalCode: '02101',
        publicAddress: '20 Public Street',
        city: 'Boston',
        businessType: 'Retailer',
        publicHours: 'Monday–Friday 09:00–17:00',
        onlineStore: true,
        physicalStore: true,
        publicDescription:
          'A locally operated sports and active play retailer serving families with product demonstrations and knowledgeable store support.',
        website: 'https://dealer.example.test',
        latitude: 42.36,
        longitude: -71.05,
        taxId: 'PRIVATE-TAX-REFERENCE',
        directoryPublished: { publicListing: true },
      };
      await api('patch', '/dealer/company', other)
        .send({ companyName: dto.companyName, profile })
        .expect(403);
      const submitted = await api('patch', '/dealer/company')
        .send({ companyName: dto.companyName, profile })
        .expect(200);
      let rows = await request(app.getHttpServer())
        .get('/api/v1/dealer/directory')
        .expect(200);
      expect(
        rows.body.data.some((row: { id: string }) => row.id === companyId),
      ).toBe(false);
      await request(app.getHttpServer())
        .get(`/api/v1/dealer/directory/${companyId}`)
        .expect(404);
      const submissionId = submitted.body.data.profile.directorySubmission.id;
      await api(
        'post',
        `/admin/b2b/companies/${companyId}/directory-review`,
        staff,
      )
        .send({
          approve: true,
          reason: 'Verified public store information',
          submissionId,
        })
        .expect(403);
      await api(
        'post',
        `/admin/b2b/companies/${companyId}/directory-review`,
        staff,
      )
        .set('x-mfa-code', await generate({ secret }))
        .send({
          approve: true,
          reason: 'Verified public store information',
          submissionId,
        })
        .expect(201);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/dealer/directory/${companyId}`)
        .expect(200);
      expect(detail.body.data).toMatchObject({
        companyName: 'Approved store ' + suffix,
        logo: '/logo.png',
        dealerType: 'Retailer',
        phone: '+15555550000',
        postalCode: '02101',
        region: 'Massachusetts',
        online: true,
        physical: true,
        detailPath: `/dealers/${companyId}`,
      });
      expect(detail.body.data.openingHours).toContain('09:00');
      expect(Array.isArray(detail.body.data.categories)).toBe(true);
      expect(JSON.stringify(detail.body.data)).not.toContain(
        'PRIVATE-TAX-REFERENCE',
      );
      expect(JSON.stringify(detail.body.data)).not.toContain('submittedBy');
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { catalogPolicy: { categoryIds: [] } },
      });
      expect(
        (
          await request(app.getHttpServer())
            .get(`/api/v1/dealer/directory/${companyId}`)
            .expect(200)
        ).body.data.categories,
      ).toEqual([]);
      const map = await request(app.getHttpServer())
        .get('/api/v1/site/sitemaps?market=US&locale=en')
        .expect(200);
      expect(
        map.body.data.items.some(
          (row: { path: string }) => row.path === `/dealers/${companyId}`,
        ),
      ).toBe(true);

      const changed = await api('patch', '/dealer/company')
        .send({
          companyName: dto.companyName,
          profile: { ...profile, displayName: 'Pending renamed store' },
        })
        .expect(200);
      expect(
        (
          await request(app.getHttpServer())
            .get(`/api/v1/dealer/directory/${companyId}`)
            .expect(200)
        ).body.data.companyName,
      ).toBe('Approved store ' + suffix);
      await api(
        'post',
        `/admin/b2b/companies/${companyId}/directory-review`,
        staff,
      )
        .set('x-mfa-code', await generate({ secret }))
        .send({
          approve: true,
          reason: 'Do not allow stale approval',
          submissionId,
        })
        .expect(409);
      await api(
        'post',
        `/admin/b2b/companies/${companyId}/directory-review`,
        staff,
      )
        .set('x-mfa-code', await generate({ secret }))
        .send({
          approve: false,
          reason: 'Please supply corrected public information',
          submissionId: changed.body.data.profile.directorySubmission.id,
        })
        .expect(201);
      await api('patch', '/dealer/company')
        .send({
          companyName: dto.companyName,
          profile: { ...profile, publicLogo: 'javascript:alert(1)' },
        })
        .expect(400);
      await api('patch', '/dealer/company')
        .send({
          companyName: dto.companyName,
          profile: { ...profile, latitude: 91 },
        })
        .expect(400);
      await api('patch', '/dealer/company')
        .send({
          companyName: dto.companyName,
          profile: { ...profile, publicListing: false },
        })
        .expect(200);
      rows = await request(app.getHttpServer())
        .get('/api/v1/dealer/directory')
        .expect(200);
      expect(
        rows.body.data.some((row: { id: string }) => row.id === companyId),
      ).toBe(false);
      await request(app.getHttpServer())
        .get(`/api/v1/dealer/directory/${companyId}`)
        .expect(404);
    });
    it('closes a company immediately while preserving business history and notifying members', async () => {
      const policy = {
        catalogPolicy: {},
        purchaseSettings: { caseWeightGrams: 3200 },
      };
      await api('put', '/admin/b2b/companies/' + companyId + '/policy', staff)
        .set('x-mfa-code', await generate({ secret }))
        .send({ ...policy, purchaseSettings: { caseWeightGrams: -1 } })
        .expect(422);
      await api('put', '/admin/b2b/companies/' + companyId + '/policy', staff)
        .set('x-mfa-code', await generate({ secret }))
        .send({ ...policy, status: 'CLOSED' })
        .expect(200);
      await api('get', '/dealer/dashboard').expect(403);
      await api('get', '/dealer/catalog').expect(403);
      expect(
        await prisma.dealerApplication.findUnique({
          where: { id: applicationId },
        }),
      ).toMatchObject({ status: 'APPROVED', companyId });
      expect(
        await prisma.dealerMember.count({ where: { companyId } }),
      ).toBeGreaterThan(0);
      expect(
        messages.some(
          (message) =>
            message.kind === 'dealer.company.status' &&
            message.to === email &&
            message.text.includes('CLOSED'),
        ),
      ).toBe(true);
      expect(
        await prisma.auditLog.findFirst({
          where: { entityId: companyId, action: 'dealer.company.policy' },
          orderBy: { createdAt: 'desc' },
        }),
      ).toMatchObject({
        before: expect.objectContaining({ status: 'APPROVED' }),
        after: expect.objectContaining({ status: 'CLOSED' }),
      });
      await api('put', '/admin/b2b/companies/' + companyId + '/policy', staff)
        .set('x-mfa-code', await generate({ secret }))
        .send({ ...policy, status: 'APPROVED' })
        .expect(200);
      await api('get', '/dealer/dashboard').expect(200);
    });

    it('accepts invitations once, protects the last owner and isolates address/member writes', async () => {
      await api('post', '/dealer/company/invitations')
        .send({ email: memberEmail, role: 'BUYER' })
        .expect(201);
      const invitation = messages
        .find(
          (m) => m.kind === 'dealer.team.invitation' && m.to === memberEmail,
        )!
        .text.match(/#invitation=([a-f0-9]{64})/)![1];
      await api('post', '/dealer/invitations/accept', other)
        .send({ token: invitation })
        .expect(403);
      await api('post', '/dealer/invitations/accept', member)
        .send({ token: invitation })
        .expect(201);
      await api('post', '/dealer/invitations/accept', member)
        .send({ token: invitation })
        .expect(403);
      await api('post', '/dealer/company/invitations')
        .send({ email, role: 'BUYER' })
        .expect(422);
      await api('patch', `/dealer/company/members/${userIds[0]}`)
        .send({ role: 'VIEWER', active: false })
        .expect(422);
      const address = {
        label: 'Main warehouse',
        kind: 'BOTH',
        address: {
          recipient: 'Receiving',
          phone: '+15551234567',
          country: 'US',
          city: 'Boston',
          addressLine: '15 Test Street',
          postalCode: '02101',
        },
      };
      await api('post', '/dealer/company/addresses', member)
        .send(address)
        .expect(403);
      const added = await api('post', '/dealer/company/addresses')
        .send(address)
        .expect(201);
      await api(
        'delete',
        `/dealer/company/addresses/${added.body.data.id}`,
        other,
      ).expect(403);
      await api('patch', `/dealer/company/members/${userIds[2]}`)
        .send({ role: 'VIEWER', active: false })
        .expect(200);
      await api('get', '/dealer/company', member).expect(403);
    });
  },
);

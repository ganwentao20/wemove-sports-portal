import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { generate, generateSecret } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { hashPassword } from '../src/auth/passwords.util.js';
import { authenticatedFixture } from './auth-session.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Identity, MFA, role matrix and customer center (DB)',
  () => {
    const prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ids: string[] = [];
    const staffIds: string[] = [];
    const roleIds: string[] = [];
    const companyIds: string[] = [];
    const mediaIds: string[] = [];
    const password = 'IdentityTest123!';
    const adminSecret = generateSecret();
    let app: INestApplication;
    let jwt: JwtService;
    let passwordHash = '';
    let adminToken = '';
    let productId = '';
    let staffSequence = 0;
    const api = (
      method: 'get' | 'post' | 'patch' | 'delete' | 'put',
      path: string,
      token?: string,
    ) => {
      const call = request(app.getHttpServer())[method](`/api/v1${path}`);
      return token ? call.set('Authorization', `Bearer ${token}`) : call;
    };
    async function customer(name = 'Customer') {
      const user = await prisma.user.create({
        data: {
          name,
          email: `identity-${suffix}-${ids.length}@example.test`,
          passwordHash,
          status: 'ACTIVE',
          ageConfirmed: true,
        },
      });
      ids.push(user.id);
      return {
        user,
        token: await authenticatedFixture(prisma, jwt, user, 'customer'),
      };
    }
    async function employee(
      permissions: string[],
      superAdmin = false,
      mfaEnabled = true,
    ) {
      const role = await prisma.role.upsert({
        where: {
          code: superAdmin
            ? 'SUPER_ADMIN'
            : `TEST_${suffix.toUpperCase()}_${staffSequence}`,
        },
        create: {
          code: superAdmin
            ? 'SUPER_ADMIN'
            : `TEST_${suffix.toUpperCase()}_${staffSequence}`,
          name: 'Identity test role',
        },
        update: {},
      });
      if (!superAdmin) roleIds.push(role.id);
      for (const code of permissions) {
        const permission = await prisma.permission.upsert({
          where: { code },
          create: { code, name: code, group: code.split(':')[0] },
          update: {},
        });
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          create: { roleId: role.id, permissionId: permission.id },
          update: {},
        });
      }
      const staff = await prisma.staff.create({
        data: {
          name: 'Identity test staff',
          email: `identity-staff-${suffix}-${staffSequence++}@example.test`,
          passwordHash,
          mfaEnabled,
          mfaSecret: mfaEnabled ? adminSecret : null,
          roles: { create: { roleId: role.id } },
        },
      });
      staffIds.push(staff.id);
      return {
        staff,
        role,
        token: await authenticatedFixture(
          prisma,
          jwt,
          staff,
          'staff',
          mfaEnabled,
        ),
      };
    }
    beforeAll(async () => {
      passwordHash = await hashPassword(password);
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      await setupApp(app);
      await app.init();
      jwt = app.get(JwtService);
      adminToken = (await employee([], true)).token;
      const product = await prisma.product.create({
        data: {
          name: 'Wishlist identity product',
          slug: `identity-${suffix}`,
          status: 'ACTIVE',
          variants: {
            create: {
              sku: `IDENTITY-${suffix}`,
              salePriceCents: 1000,
              stock: { create: { available: 20 } },
            },
          },
        },
      });
      productId = product.id;
    });
    afterAll(async () => {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
      await prisma.newsletterSubscription.deleteMany({
        where: { email: { startsWith: `identity-${suffix}-` } },
      });
      await prisma.notificationOutbox.deleteMany({
        where: {
          OR: ids.map((id) => ({
            dedupeKey: { startsWith: `account:${id}:` },
          })),
        },
      });
      await prisma.dealerApplicationDraft.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.dealerProcurementCart.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.accountPrivacyRequest.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [...ids, ...staffIds] } },
      });
      await prisma.staffLoginChallenge.deleteMany({
        where: { staffId: { in: staffIds } },
      });
      await prisma.contactMessage.deleteMany({
        where: { email: { in: ids.map((id) => `${id}@deleted.invalid`) } },
      });
      await prisma.dealerApplication.deleteMany({
        where: { applicantId: { in: ids } },
      });
      await prisma.order.deleteMany({ where: { userId: { in: ids } } });
      await prisma.dealerCompany.deleteMany({
        where: { id: { in: companyIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      if (productId) await prisma.product.delete({ where: { id: productId } });
      await app?.close();
      await prisma.$disconnect();
    });
    it('rejects staff tokens at dealer routes even when shared services support administrators', async () => {
      await api('get', '/admin/dealer/applications', adminToken).expect(200);
      await api('get', '/dealer/terms', adminToken).expect(403);
      await api('get', '/dealer/catalog', adminToken).expect(403);
      await api(
        'get',
        '/dealer/purchase-orders/unknown/documents/invoice',
        adminToken,
      ).expect(403);
    });
    it('issues no staff access token for password-only login, enrolls safely and consumes each MFA challenge once', async () => {
      const { staff } = await employee([], false, false);
      const start = await api('post', '/auth/staff/login')
        .send({ email: staff.email, password })
        .expect(200);
      expect(start.body.data).toMatchObject({
        mfaRequired: true,
        enrollmentRequired: true,
      });
      expect(start.body.data.accessToken).toBeUndefined();
      await api('get', '/auth/me', start.body.data.challengeToken).expect(401);
      const code = await generate({ secret: start.body.data.secret });
      const verified = await api('post', '/auth/staff/mfa')
        .send({ challengeToken: start.body.data.challengeToken, code })
        .expect(200);
      expect(verified.body.data.accessToken).toBeTruthy();
      await api('get', '/auth/me', verified.body.data.accessToken).expect(200);
      await api('post', '/auth/staff/mfa')
        .send({ challengeToken: start.body.data.challengeToken, code })
        .expect(401);
      const again = await api('post', '/auth/staff/login')
        .send({ email: staff.email, password })
        .expect(200);
      expect(again.body.data.enrollmentRequired).toBe(false);
      expect(again.body.data.secret).toBeUndefined();
      expect(again.body.data.accessToken).toBeUndefined();
    });
    it('locks a staff challenge after five invalid codes using persisted attempt counts', async () => {
      const { staff } = await employee([], false, false);
      const start = await api('post', '/auth/staff/login')
        .send({ email: staff.email, password })
        .expect(200);
      const valid = await generate({ secret: start.body.data.secret });
      const invalid = ((Number(valid[0]) + 1) % 10) + valid.slice(1);
      for (let i = 0; i < 5; i++) {
        const result = await api('post', '/auth/staff/mfa').send({
          challengeToken: start.body.data.challengeToken,
          code: invalid,
        });
        expect([403, 429]).toContain(result.status);
      }
      await api('post', '/auth/staff/mfa')
        .send({ challengeToken: start.body.data.challengeToken, code: valid })
        .expect(401);
      expect(
        await prisma.staff.findUnique({ where: { id: staff.id } }),
      ).toMatchObject({ mfaEnabled: false });
    });
    it('rejects legacy untracked tokens, expired sessions, suspended users and disabled staff immediately', async () => {
      const { user, token } = await customer();
      const legacy = await jwt.signAsync(
        { sub: user.id, kind: 'customer', email: user.email, name: user.name },
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      await api('get', '/auth/me', legacy).expect(401);
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'SUSPENDED' },
      });
      await api('get', '/auth/me', token).expect(401);
      const { staff, token: staffToken } = await employee(['reports:read']);
      await prisma.staff.update({
        where: { id: staff.id },
        data: { status: 'DISABLED' },
      });
      await api('get', '/dashboard/stats', staffToken).expect(401);
      const expired = await customer();
      await prisma.authenticationSession.updateMany({
        where: { ownerId: expired.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await api('get', '/auth/me', expired.token).expect(401);
    });
    it('enforces guest, registered customer, dealer member and dealer owner boundaries', async () => {
      await api('get', '/account/profile').expect(401);
      const registered = await customer();
      await api('get', '/account/profile', registered.token).expect(200);
      await api('get', '/admin/users', registered.token).expect(403);
      await api('get', '/dealer/rfqs', registered.token).expect(403);
      const company = await prisma.dealerCompany.create({
        data: {
          companyName: 'Identity role matrix',
          legalRegNo: `identity-${suffix}`,
          country: 'US',
          status: 'APPROVED',
        },
      });
      companyIds.push(company.id);
      for (const role of ['VIEWER', 'OWNER'] as const) {
        const actor = await customer(role);
        await prisma.dealerMember.create({
          data: {
            companyId: company.id,
            userId: actor.user.id,
            role,
            termsVersion: 'dealer-terms-2026-09',
            termsAcceptedAt: new Date(),
          },
        });
        await api('get', '/dealer/rfqs', actor.token).expect(200);
        const me = await api('get', '/auth/me', actor.token).expect(200);
        expect(me.body.data.companyRole).toBe(role);
        await prisma.dealerMember.update({
          where: {
            companyId_userId: { companyId: company.id, userId: actor.user.id },
          },
          data: { active: false },
        });
        await api('get', '/dealer/rfqs', actor.token).expect(403);
      }
    });
    it('enforces support/content/catalog/dealer-operations/admin/super role matrix across unrelated modules', async () => {
      const cases = [
        {
          name: 'support',
          permissions: ['user:read', 'contact:read', 'order:read'],
          allow: '/admin/users',
          deny: '/admin/catalog/products',
        },
        {
          name: 'content',
          permissions: ['cms:read', 'cms:write', 'media:read', 'reports:read'],
          allow: '/admin/cms/pages',
          deny: '/admin/orders',
        },
        {
          name: 'catalog',
          permissions: ['catalog:product:read', 'catalog:product:write'],
          allow: '/admin/catalog/products',
          deny: '/admin/users',
        },
        {
          name: 'dealer ops',
          permissions: ['b2b:read'],
          allow: '/admin/b2b/rfqs',
          deny: '/admin/catalog/products',
        },
        {
          name: 'administrator',
          permissions: ['user:read', 'cms:read', 'catalog:product:read'],
          allow: '/admin/users',
          deny: '/admin/roles',
        },
      ];
      for (const row of cases) {
        const { token } = await employee(row.permissions);
        const allowed = await api('get', row.allow, token);
        expect(allowed.status, row.name + ' allowed').toBe(200);
        await api('get', row.deny, token).expect(403);
      }
      for (const path of ['/admin/users', 'admin/roles', '/admin/audit'].map(
        (p) => (p.startsWith('/') ? p : '/' + p),
      ))
        await api('get', path, adminToken).expect(200);
    });
    it('applies role removal and individual deny/grant changes to existing staff sessions', async () => {
      const { staff, role, token } = await employee(['catalog:product:read']);
      await api('get', '/admin/catalog/products', token).expect(200);
      await prisma.staff.update({
        where: { id: staff.id },
        data: { permissionOverrides: { deny: ['catalog:product:read'] } },
      });
      await api('get', '/admin/catalog/products', token).expect(403);
      await prisma.staff.update({
        where: { id: staff.id },
        data: { permissionOverrides: { grant: ['user:read'] } },
      });
      await api('get', '/admin/users', token).expect(200);
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await api('get', '/admin/catalog/products', token).expect(403);
    });
    it('requires a fresh authenticator code on sensitive staff and privacy mutations', async () => {
      const { user } = await customer();
      await api('patch', `/admin/users/${user.id}/status`, adminToken)
        .send({
          status: 'SUSPENDED',
          reason: 'Verified policy violation review',
        })
        .expect(403);
      await api('patch', `/admin/users/${user.id}/status`, adminToken)
        .set('x-mfa-code', await generate({ secret: adminSecret }))
        .send({
          status: 'SUSPENDED',
          reason: 'Verified policy violation review',
        })
        .expect(200);
    });
    it('requires an audited suspension reason and lets support request a private password reset', async () => {
      const { user } = await customer();
      const detail = await api(
        'get',
        `/admin/users/${user.id}`,
        adminToken,
      ).expect(200);
      expect(detail.body.data.profile.email).toBe(user.email);
      expect(JSON.stringify(detail.body.data)).not.toContain('passwordHash');
      await api('patch', `/admin/users/${user.id}/status`, adminToken)
        .set('x-mfa-code', await generate({ secret: adminSecret }))
        .send({ status: 'SUSPENDED' })
        .expect(400);
      await api('post', `/admin/users/${user.id}/password-reset`, adminToken)
        .set('x-mfa-code', await generate({ secret: adminSecret }))
        .send({})
        .expect(201);
      expect(
        await prisma.userToken.count({
          where: { userId: user.id, type: 'PASSWORD_RESET', consumedAt: null },
        }),
      ).toBe(1);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
          .passwordHash,
      ).toBe(user.passwordHash);
      expect(
        await prisma.auditLog.count({
          where: {
            entityId: user.id,
            action: 'account.password.reset_requested',
          },
        }),
      ).toBe(1);
    });
    it('lists real sessions, scopes revocation to the owner, and invalidates all sessions after password change', async () => {
      const a = await customer();
      const second = await authenticatedFixture(
        prisma,
        jwt,
        a.user,
        'customer',
      );
      const outsider = await customer();
      const sessions = await api('get', '/account/sessions', a.token).expect(
        200,
      );
      expect(sessions.body.data).toHaveLength(2);
      const other = sessions.body.data.find(
        (x: { current: boolean }) => !x.current,
      );
      const forbidden = await api(
        'delete',
        `/account/sessions/${other.id}`,
        outsider.token,
      ).expect(200);
      expect(forbidden.body.data.revoked).toBe(0);
      await api('delete', '/account/sessions', a.token).expect(200);
      await api('get', '/auth/me', second).expect(401);
      await api('get', '/auth/me', a.token).expect(200);
      await api('post', '/account/password', a.token)
        .send({ oldPassword: password, newPassword: 'ChangedIdentity123!' })
        .expect(201);
      await api('get', '/auth/me', a.token).expect(401);
    });
    const address = {
      label: 'Home',
      recipient: 'Recipient',
      phone: '555123456',
      country: 'US',
      region: 'MA',
      city: 'Boston',
      postalCode: '02101',
      line1: '123 Example Street',
      line2: '',
      isDefaultShipping: true,
      isDefaultBilling: true,
    };
    it('maintains one default address and prevents cross-account editing or deletion', async () => {
      const a = await customer();
      const b = await customer();
      const first = await api('post', '/account/addresses', a.token)
        .send(address)
        .expect(201);
      await api('post', '/account/addresses', a.token)
        .send({ ...address, label: 'Office' })
        .expect(201);
      const rows = await api('get', '/account/addresses', a.token).expect(200);
      expect(
        rows.body.data.filter(
          (x: { isDefaultShipping: boolean }) => x.isDefaultShipping,
        ),
      ).toHaveLength(1);
      await api('patch', `/account/addresses/${first.body.data.id}`, b.token)
        .send(address)
        .expect(404);
      await api(
        'delete',
        `/account/addresses/${first.body.data.id}`,
        b.token,
      ).expect(404);
      await api('patch', `/account/addresses/${first.body.data.id}`, a.token)
        .send({ ...address, country: 'XXinvalid' })
        .expect(400);
    });
    it('gates first dealer login on explicit current terms and records each version once', async () => {
      const a = await customer('New dealer member'),
        company = await prisma.dealerCompany.create({
          data: {
            companyName: 'Dealer terms test',
            legalRegNo: `terms-${suffix}`,
            country: 'US',
            status: 'APPROVED',
          },
        });
      companyIds.push(company.id);
      await prisma.dealerMember.create({
        data: { companyId: company.id, userId: a.user.id, role: 'BUYER' },
      });
      const login = await api('post', '/auth/login')
        .send({ email: a.user.email, password })
        .expect(200);
      expect(login.body.data.user.dealerTermsRequired).toBe(true);
      await api('get', '/dealer/catalog', a.token).expect(403);
      const files = await Promise.all(
        (['REGISTERED', 'DEALER_ONLY'] as const).map((visibility) =>
          prisma.mediaAsset.create({
            data: {
              key: `identity-terms-${suffix}-${visibility}`,
              fileName: `${visibility}.pdf`,
              mimeType: 'application/pdf',
              sizeBytes: 123,
              visibility,
              scanStatus: 'CLEAN',
              companyIds: visibility === 'DEALER_ONLY' ? [company.id] : [],
            },
          }),
        ),
      );
      mediaIds.push(...files.map((file) => file.id));
      const downloads = await api('get', '/media/downloads', a.token).expect(
        200,
      );
      expect(
        downloads.body.data.map((file: { id: string }) => file.id),
      ).toContain(files[0].id);
      expect(
        downloads.body.data.map((file: { id: string }) => file.id),
      ).not.toContain(files[1].id);
      await api('get', `/media/${files[1].id}/access`, a.token).expect(403);
      const terms = await api('get', '/dealer/terms', a.token).expect(200);
      expect(terms.body.data).toMatchObject({
        version: 'dealer-terms-2026-09',
        accepted: false,
        companyId: company.id,
      });
      expect(terms.body.data.sections.length).toBeGreaterThan(3);
      await api('post', '/dealer/terms', a.token)
        .send({ version: 'dealer-terms-2026-09', accepted: false })
        .expect(400);
      await api('post', '/dealer/terms', a.token)
        .send({ version: 'dealer-terms-previous', accepted: true })
        .expect(409);
      await Promise.all([
        api('post', '/dealer/terms', a.token)
          .send({ version: terms.body.data.version, accepted: true })
          .expect(201),
        api('post', '/dealer/terms', a.token)
          .send({ version: terms.body.data.version, accepted: true })
          .expect(201),
      ]);
      const saved = await prisma.dealerMember.findUniqueOrThrow({
        where: {
          companyId_userId: { companyId: company.id, userId: a.user.id },
        },
      });
      expect(saved.termsVersion).toBe(terms.body.data.version);
      expect(saved.termsAcceptedAt).toBeInstanceOf(Date);
      expect(saved.termsAcceptedIp).toBeTruthy();
      const acceptedDownloads = await api(
        'get',
        '/media/downloads',
        a.token,
      ).expect(200);
      expect(
        acceptedDownloads.body.data.map((file: { id: string }) => file.id),
      ).toContain(files[1].id);
      expect(
        await prisma.auditLog.count({
          where: {
            actorCustomerId: a.user.id,
            action: 'dealer.terms.accepted',
          },
        }),
      ).toBe(1);
      await api('get', '/dealer/catalog', a.token).expect(200);
      expect(
        (await api('get', '/auth/me', a.token).expect(200)).body.data
          .dealerTermsRequired,
      ).toBe(false);
      const exported = await api('get', '/account/export', a.token).expect(200);
      expect(exported.body.data.dealerTerms).toEqual([
        expect.objectContaining({
          companyId: company.id,
          termsVersion: terms.body.data.version,
        }),
      ]);
      await prisma.dealerMember.update({
        where: {
          companyId_userId: { companyId: company.id, userId: a.user.id },
        },
        data: { termsVersion: 'dealer-terms-previous' },
      });
      await api('get', '/dealer/catalog', a.token).expect(403);
      const outsider = await customer();
      await api('post', '/dealer/terms', outsider.token)
        .send({ version: terms.body.data.version, accepted: true })
        .expect(403);
    });
    it('synchronizes account newsletter choices and token unsubscribe without affecting transactional mail', async () => {
      const a = await customer();
      const token = randomUUID().replaceAll('-', '').repeat(2),
        tokenHash = createHash('sha256').update(token).digest('hex');
      await prisma.newsletterSubscription.create({
        data: {
          email: a.user.email,
          status: 'ACTIVE',
          locale: 'en',
          tokenHash,
          consentVersion: 'privacy-test',
          expiresAt: new Date(Date.now() + 86400_000),
        },
      });
      const profile = {
        name: 'Preference tester',
        locale: 'en',
        marketingEmail: false,
        marketingSms: false,
      };
      await api('patch', '/account/profile', a.token).send(profile).expect(200);
      expect(
        await prisma.newsletterSubscription.findUnique({
          where: { email: a.user.email },
        }),
      ).toMatchObject({ status: 'UNSUBSCRIBED' });
      await api('post', '/newsletter/confirm').send({ token }).expect(404);
      await api('patch', '/account/profile', a.token)
        .send({ ...profile, locale: 'fr', marketingEmail: true })
        .expect(200);
      const active = await prisma.newsletterSubscription.findUniqueOrThrow({
        where: { email: a.user.email },
      });
      expect(active).toMatchObject({ status: 'ACTIVE', locale: 'fr' });
      expect(active.tokenHash).not.toBe(tokenHash);
      await prisma.newsletterSubscription.update({
        where: { email: a.user.email },
        data: { tokenHash },
      });
      await api('post', '/newsletter/unsubscribe').send({ token }).expect(201);
      expect(
        await prisma.user.findUnique({ where: { id: a.user.id } }),
      ).toMatchObject({ marketingEmail: false });
      await prisma.notificationOutbox.deleteMany({
        where: {
          dedupeKey: { startsWith: `newsletter-unsubscribe:${tokenHash}` },
        },
      });
    });
    it('persists profiles, subscription preferences and idempotent wishlist entries; exports no credentials', async () => {
      const a = await customer();
      await api('patch', '/account/profile', a.token)
        .send({
          name: 'Updated customer',
          displayName: 'Tester',
          country: 'CN',
          productUpdates: true,
          phone: '5551234',
          locale: 'zh',
          marketingEmail: true,
          marketingSms: false,
        })
        .expect(200);
      for (let i = 0; i < 2; i++)
        await api('post', `/account/favorites/${productId}`, a.token).expect(
          201,
        );
      const favorites = await api('get', '/account/favorites', a.token).expect(
        200,
      );
      expect(favorites.body.data).toHaveLength(1);
      const variantId = favorites.body.data[0].product.variants[0].id;
      await api('post', '/cart/items', a.token)
        .send({ variantId, quantity: 1 })
        .expect(201);
      const cart = await api('get', '/cart', a.token).expect(200);
      expect(cart.body.data.items).toHaveLength(1);
      const data = await api('get', '/account/export', a.token).expect(200);
      expect(data.body.data.profile).toMatchObject({
        name: 'Updated customer',
        displayName: 'Tester',
        country: 'CN',
        productUpdates: true,
        locale: 'zh',
        marketingEmail: true,
      });
      expect(JSON.stringify(data.body.data)).not.toMatch(
        /passwordHash|mfaSecret|tokenHash/,
      );
      expect(
        await prisma.accountPrivacyRequest.count({
          where: { userId: a.user.id, type: 'EXPORT', status: 'COMPLETED' },
        }),
      ).toBe(1);
    });
    it('records duplicate-safe deletion requests and requires support resolution before anonymization', async () => {
      const a = await customer();
      await prisma.newsletterSubscription.create({
        data: {
          email: a.user.email,
          locale: 'en',
          status: 'ACTIVE',
          tokenHash: randomUUID(),
          consentVersion: 'privacy-2026-09',
          expiresAt: new Date(Date.now() + 86400_000),
        },
      });
      const contact = await prisma.contactMessage.create({
        data: {
          name: a.user.name,
          email: a.user.email,
          subject: 'Personal support request',
          content: 'Contains personal request details.',
          history: [{ action: 'note', text: 'Private internal handling note' }],
        },
      });
      const application = await prisma.dealerApplication.create({
        data: {
          applicantId: a.user.id,
          companyName: 'Personal applicant shop',
          legalRegNo: `privacy-${a.user.id}`,
          contactName: a.user.name,
          contactEmail: a.user.email,
          phone: '5551234',
          country: 'US',
          businessType: 'RETAILER',
        },
      });
      const personal = await api('get', '/account/export', a.token).expect(200);
      expect(personal.body.data.newsletter.status).toBe('ACTIVE');
      expect(
        personal.body.data.contacts.some(
          (item: { id: string }) => item.id === contact.id,
        ),
      ).toBe(true);
      expect(JSON.stringify(personal.body.data.contacts)).not.toContain(
        'Private internal handling note',
      );
      await api('post', '/account/addresses', a.token)
        .send(address)
        .expect(201);
      const first = await api('post', '/account/deletion-request', a.token)
        .send({ password, reason: 'Please close my account' })
        .expect(201);
      const again = await api('post', '/account/deletion-request', a.token)
        .send({ password, reason: 'Please close my account' })
        .expect(201);
      expect(again.body.data.id).toBe(first.body.data.id);
      await api(
        'patch',
        `/admin/users/privacy-requests/${first.body.data.id}`,
        adminToken,
      )
        .set('x-mfa-code', await generate({ secret: adminSecret }))
        .send({
          status: 'COMPLETED',
          resolution:
            'Personal profile removed; no open commercial obligations.',
        })
        .expect(200);
      await api('get', '/auth/me', a.token).expect(401);
      const saved = await prisma.user.findUniqueOrThrow({
        where: { id: a.user.id },
      });
      expect(saved.email).toMatch(/@deleted.invalid$/);
      expect(saved.name).toBe('Deleted account');
      expect(
        await prisma.newsletterSubscription.findUnique({
          where: { email: a.user.email },
        }),
      ).toBeNull();
      expect(
        await prisma.contactMessage.findUnique({ where: { id: contact.id } }),
      ).toMatchObject({
        name: 'Deleted account',
        email: `${a.user.id}@deleted.invalid`,
        history: [],
      });
      expect(
        await prisma.dealerApplication.findUnique({
          where: { id: application.id },
        }),
      ).toMatchObject({
        contactEmail: `${a.user.id}@deleted.invalid`,
        status: 'REJECTED',
        attachments: [],
      });

      expect(
        await prisma.accountAddress.count({ where: { userId: a.user.id } }),
      ).toBe(0);
    });
    it('blocks deletion with open orders and preserves the unresolved request transactionally', async () => {
      const a = await customer();
      await prisma.order.create({
        data: {
          userId: a.user.id,
          orderNo: `IDENTITY-${suffix}`,
          subtotalCents: 100,
          totalCents: 100,
        },
      });
      const created = await api('post', '/account/deletion-request', a.token)
        .send({ password, reason: 'Please remove data' })
        .expect(201);
      await api(
        'patch',
        `/admin/users/privacy-requests/${created.body.data.id}`,
        adminToken,
      )
        .set('x-mfa-code', await generate({ secret: adminSecret }))
        .send({
          status: 'COMPLETED',
          resolution: 'Attempting requested deletion.',
        })
        .expect(409);
      expect(
        await prisma.accountPrivacyRequest.findUnique({
          where: { id: created.body.data.id },
        }),
      ).toMatchObject({ status: 'OPEN' });
      await api('get', '/auth/me', a.token).expect(200);
    });
    it('enforces company MFA policy while preserving a safe enrollment route', async () => {
      const a = await customer();
      const company = await prisma.dealerCompany.create({
        data: {
          companyName: 'MFA enterprise',
          legalRegNo: `identity-mfa-${suffix}`,
          country: 'US',
          status: 'APPROVED',
          purchaseSettings: { requireMfa: true },
        },
      });
      companyIds.push(company.id);
      await prisma.dealerMember.create({
        data: {
          companyId: company.id,
          userId: a.user.id,
          role: 'OWNER',
          termsVersion: 'dealer-terms-2026-09',
          termsAcceptedAt: new Date(),
        },
      });
      await api('get', '/dealer/rfqs', a.token).expect(403);
      await api('get', '/media/downloads', a.token).expect(403);
      await api('get', '/account/profile', a.token).expect(200);
      const setup = await api('post', '/account/mfa/setup', a.token)
        .send({ password })
        .expect(201);
      const code = await generate({ secret: setup.body.data.secret });
      await api('post', '/account/mfa/confirm', a.token)
        .send({ code })
        .expect(201);
      await api('get', '/auth/me', a.token).expect(401);
      await api('post', '/auth/login')
        .send({ email: a.user.email, password })
        .expect(403);
      const login = await api('post', '/auth/login')
        .send({ email: a.user.email, password, code })
        .expect(200);
      await api('get', '/dealer/rfqs', login.body.data.accessToken).expect(200);
      await api('post', '/account/mfa/disable', login.body.data.accessToken)
        .send({ code })
        .expect(403);
    });
    it('validates explicit privacy/terms consent separately from adulthood and marketing', async () => {
      await api('post', '/auth/register')
        .send({
          email: `consent-${suffix}@example.test`,
          name: 'Consent test',
          password,
          ageConfirmed: true,
        })
        .expect(400);
      await api('post', '/auth/register')
        .send({
          email: `consent-${suffix}@example.test`,
          name: 'Consent test',
          password,
          ageConfirmed: true,
          termsAccepted: false,
        })
        .expect(400);
    });
    it('allows authorized MFA recovery only with fresh MFA and records the reason while revoking access', async () => {
      const target = await employee(['reports:read']);
      await api('post', `/admin/staff/${target.staff.id}/mfa-reset`, adminToken)
        .send({ reason: 'Verified staff identity through company process' })
        .expect(403);
      await api('post', `/admin/staff/${target.staff.id}/mfa-reset`, adminToken)
        .set('x-mfa-code', await generate({ secret: adminSecret }))
        .send({ reason: 'Verified staff identity through company process' })
        .expect(201);
      await api('get', '/auth/me', target.token).expect(401);
      expect(
        await prisma.staff.findUnique({ where: { id: target.staff.id } }),
      ).toMatchObject({ mfaEnabled: false, mfaSecret: null });
      expect(
        await prisma.auditLog.findFirst({
          where: { entityId: target.staff.id, action: 'staff.mfa.admin_reset' },
        }),
      ).toBeTruthy();
      const a = await customer();
      await prisma.user.update({
        where: { id: a.user.id },
        data: { mfaEnabled: true, mfaSecret: adminSecret },
      });
      await api('post', `/admin/users/${a.user.id}/mfa-reset`, adminToken)
        .set('x-mfa-code', await generate({ secret: adminSecret }))
        .send({ reason: 'Verified account owner through support process' })
        .expect(201);
      await api('get', '/auth/me', a.token).expect(401);
    });
  },
);

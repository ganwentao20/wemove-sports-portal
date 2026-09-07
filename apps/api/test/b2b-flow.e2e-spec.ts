import { authenticatedFixture } from './auth-session.js';
import { signPayment } from '../src/order/commerce-rules.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { generate, generateSecret } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';

/** M1/MB：真实 PostgreSQL 事务与 HTTP/DTO/JWT/RBAC/MFA；Redis 使用运行环境配置。 */
describe.skipIf(process.env.E2E_DB !== '1')('B2B procurement (DB)', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const secret = generateSecret();
  let app: INestApplication;
  let companyId = '',
    otherCompanyId = '',
    productId = '',
    variantId = '',
    secondVariantId = '',
    staffId = '',
    bookId = '';
  const users: string[] = [];
  let owner = '',
    buyer = '',
    viewer = '',
    outsider = '',
    staff = '';
  const sku = `B2B-${suffix.toUpperCase()}`;
  const address = {
    recipient: 'Procurement Tester',
    phone: '+1 555 0100',
    country: 'US',
    city: 'Boston',
    addressLine: '10 Test Street',
    postalCode: '02101',
  };
  const api = (
    method: 'get' | 'post' | 'patch' | 'put',
    path: string,
    token = owner,
  ) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);
  const mfa = () => generate({ secret });
  const future = () => new Date(Date.now() + 3600000).toISOString();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await setupApp(app);
    await app.init();
    const jwt = app.get(JwtService);
    const company = await prisma.dealerCompany.create({
      data: {
        companyName: 'B2B test',
        legalRegNo: `B2B-${suffix}`,
        country: 'US',
        status: 'APPROVED',
      },
    });
    companyId = company.id;
    const other = await prisma.dealerCompany.create({
      data: {
        companyName: 'Other test',
        legalRegNo: `OTHER-${suffix}`,
        country: 'US',
        status: 'APPROVED',
      },
    });
    otherCompanyId = other.id;
    async function member(
      role: 'OWNER' | 'BUYER' | 'VIEWER',
      tenant = companyId,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${suffix}-${users.length}@b2b.test`,
          name: role,
          ageConfirmed: true,
          passwordHash: 'unused-test-password-hash',
          status: 'ACTIVE',
          dealerMembers: {
            create: {
              companyId: tenant,
              role,
              termsVersion: 'dealer-terms-2026-09',
              termsAcceptedAt: new Date(),
            },
          },
        },
      });
      users.push(user.id);
      return authenticatedFixture(prisma, jwt, user, 'customer');
    }
    owner = await member('OWNER');
    buyer = await member('BUYER');
    viewer = await member('VIEWER');
    outsider = await member('OWNER', otherCompanyId);
    const admin = await prisma.staff.create({
      data: {
        email: `${suffix}@b2b-admin.test`,
        name: 'B2B Admin',
        passwordHash: 'unused',
        mfaEnabled: true,
        mfaSecret: secret,
      },
    });
    staffId = admin.id;
    const role = await prisma.role.upsert({
      where: { code: 'SUPER_ADMIN' },
      create: { code: 'SUPER_ADMIN', name: 'Super administrator' },
      update: {},
    });
    await prisma.staffRole.create({
      data: { staffId: admin.id, roleId: role.id },
    });
    staff = await authenticatedFixture(prisma, jwt, admin, 'staff');
    const product = await prisma.product.create({
      data: {
        name: 'B2B test product',
        slug: `b2b-${suffix}`,
        status: 'ACTIVE',
        variants: {
          create: [
            {
              sku,
              b2bDefaultPriceCents: 2000,
              stock: { create: { available: 20 } },
            },
            {
              sku: `${sku}-SECOND`,
              b2bDefaultPriceCents: 1800,
              stock: { create: { available: 20 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants.find((item) => item.sku === sku)!.id;
    secondVariantId = product.variants.find((item) => item.sku !== sku)!.id;
  });
  beforeEach(async () => {
    await prisma.stock.updateMany({
      where: { variantId: { in: [variantId, secondVariantId] } },
      data: { available: 20, reserved: 0 },
    });
  });
  afterAll(async () => {
    await prisma.authenticationSession.deleteMany({
      where: { ownerId: { in: [...users, staffId] } },
    });
    await prisma.purchaseOrder.deleteMany({
      where: { companyId: { in: [companyId, otherCompanyId] } },
    });
    await prisma.dealerRfq.deleteMany({
      where: { companyId: { in: [companyId, otherCompanyId] } },
    });
    if (bookId) await prisma.priceBook.delete({ where: { id: bookId } });
    await prisma.dealerCompany.deleteMany({
      where: { id: { in: [companyId, otherCompanyId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (staffId) await prisma.staff.delete({ where: { id: staffId } });
    await prisma.$disconnect();
    await app?.close();
  });
  async function draft(lines = [{ sku, quantity: 2 }]) {
    const created = await api('post', '/dealer/rfqs')
      .send({ title: `Restock ${suffix}`, lines })
      .expect(201);
    return created.body.data.id as string;
  }
  async function quoted(lines = [{ sku, quantity: 2 }]) {
    const id = await draft(lines);
    await api('post', `/dealer/rfqs/${id}/submit`).send({}).expect(201);
    await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff)
      .set('x-mfa-code', await mfa())
      .send({
        revision: 0,
        lines: lines.map((item) => ({ sku: item.sku, unitPriceCents: 1500 })),
        taxCents: 100,
        shippingCents: 200,
        validUntil: future(),
      })
      .expect(201);
    return id;
  }
  const accept = (id: string, token = owner, version = 1) =>
    api('post', `/dealer/rfqs/${id}/accept`, token).send({
      version,
      shippingAddress: address,
    });

  it('creates a staff-authorized PO once, keeps quote prices and records the staff reason without forging dealer acceptance', async () => {
    const id = await quoted();
    const path = '/admin/b2b/rfqs/' + id + '/purchase-order';
    const body = {
      version: 1,
      shippingAddress: address,
      customerPoNumber: 'PHONE-' + suffix,
      paymentMethod: 'BANK_TRANSFER',
      staffReason: 'Customer confirmed procurement by telephone',
    };
    const termsBefore = await prisma.dealerMember.findUniqueOrThrow({
      where: { companyId_userId: { companyId, userId: users[0] } },
    });
    await api('post', path).send(body).expect(403);
    await api('post', path, staff).send(body).expect(403);
    await api('post', path, staff)
      .set('x-mfa-code', await mfa())
      .send({ ...body, staffReason: '' })
      .expect(400);
    const code = await mfa();
    const requests = await Promise.all([
      api('post', path, staff).set('x-mfa-code', code).send(body),
      api('post', path, staff).set('x-mfa-code', code).send(body),
    ]);
    expect(requests.map((row) => row.status)).toEqual([201, 201]);
    expect(requests[0].body.data.id).toBe(requests[1].body.data.id);
    const order = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: requests[0].body.data.id },
      include: { items: true },
    });
    expect(order).toMatchObject({
      createdById: users[0],
      companyId,
      status: 'PENDING_REVIEW',
      totalCents: 3300,
    });
    expect(order.items[0].unitPriceCents).toBe(1500);
    expect(order.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'STAFF_CREATE',
          actorId: staffId,
          reason: body.staffReason,
        }),
      ]),
    );
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 18, reserved: 2 });
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'dealer.po.manual.create',
          entityId: order.id,
          actorStaffId: staffId,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'dealer.rfq.accept', entityId: id },
      }),
    ).toBe(0);
    const termsAfter = await prisma.dealerMember.findUniqueOrThrow({
      where: { companyId_userId: { companyId, userId: users[0] } },
    });
    expect(termsAfter.termsAcceptedAt).toEqual(termsBefore.termsAcceptedAt);
    await api('post', path, staff)
      .set('x-mfa-code', await mfa())
      .send({ ...body, customerPoNumber: 'DIFFERENT' })
      .expect(409);
  });
  it('rechecks company, SKU authorization, purchase rules and stock before staff conversion with deferred reservation', async () => {
    const previous = await prisma.dealerCompany.findUniqueOrThrow({
        where: { id: companyId },
      }),
      id = await quoted();
    const path = '/admin/b2b/rfqs/' + id + '/purchase-order',
      body = {
        version: 1,
        shippingAddress: address,
        staffReason: 'Customer sent approved purchase authorization',
      };
    const create = async () =>
      api('post', path, staff)
        .set('x-mfa-code', await mfa())
        .send(body);
    try {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: {
          purchaseSettings: { reserveAt: 'CONFIRM' },
          catalogPolicy: { productIds: [] },
        },
      });
      expect((await create()).status).toBe(409);
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: {
          catalogPolicy: { productIds: [productId] },
          status: 'SUSPENDED',
        },
      });
      expect((await create()).status).toBe(409);
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: {
          status: 'APPROVED',
          purchaseSettings: { reserveAt: 'CONFIRM', moq: 3 },
        },
      });
      expect((await create()).status).toBe(409);
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { purchaseSettings: { reserveAt: 'CONFIRM' } },
      });
      await prisma.stock.update({
        where: { variantId },
        data: { syncError: 'ERP disconnected' },
      });
      expect((await create()).status).toBe(409);
      await prisma.stock.update({
        where: { variantId },
        data: { syncError: null, available: 1 },
      });
      expect((await create()).status).toBe(409);
      await prisma.stock.update({
        where: { variantId },
        data: { available: 20 },
      });
      const result = await create();
      expect(result.status).toBe(201);
      expect(result.body.data.inventoryReserved).toBe(false);
      expect(
        await prisma.stock.findUnique({ where: { variantId } }),
      ).toMatchObject({ available: 20, reserved: 0 });
    } finally {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: {
          status: previous.status,
          purchaseSettings: previous.purchaseSettings!,
          catalogPolicy: previous.catalogPolicy!,
        },
      });
      await prisma.stock.update({
        where: { variantId },
        data: { available: 20, reserved: 0, syncError: null },
      });
    }
  });
  it('enforces anonymous, customer/staff and VIEWER boundaries', async () => {
    await request(app.getHttpServer()).get('/api/v1/dealer/rfqs').expect(401);
    await api('get', '/dealer/rfqs', staff).expect(403);
    await api('get', '/admin/b2b/rfqs').expect(403);
    await api('post', '/dealer/rfqs', viewer)
      .send({ title: 'Forbidden', lines: [{ sku, quantity: 1 }] })
      .expect(403);
    await api('get', '/dealer/rfqs', viewer).expect(200);
  });
  it('rejects empty/oversize/duplicate rows and missing delivery details', async () => {
    for (const lines of [
      [],
      [{ sku, quantity: 0 }],
      [
        { sku, quantity: 1 },
        { sku, quantity: 2 },
      ],
    ]) {
      const response = await api('post', '/dealer/rfqs').send({
        title: 'Invalid',
        lines,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    const id = await quoted();
    await api('post', `/dealer/rfqs/${id}/accept`)
      .send({ version: 1 })
      .expect(400);
    expect(await prisma.purchaseOrder.count({ where: { rfqId: id } })).toBe(0);
  });
  it('uses live membership and company status instead of stale JWT claims', async () => {
    await prisma.dealerMember.update({
      where: { companyId_userId: { companyId, userId: users[1] } },
      data: { role: 'VIEWER' },
    });
    await api('post', '/dealer/rfqs', buyer)
      .send({ title: 'Revoked buyer', lines: [{ sku, quantity: 1 }] })
      .expect(403);
    await prisma.dealerMember.update({
      where: { companyId_userId: { companyId, userId: users[1] } },
      data: { role: 'BUYER' },
    });
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: { status: 'SUSPENDED' },
    });
    await api('get', '/dealer/rfqs').expect(403);
    await api('get', '/dealer/catalog').expect(403);
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: { status: 'APPROVED' },
    });
  });
  it('isolates other companies from RFQ actions and purchase orders', async () => {
    const id = await quoted();
    await accept(id, outsider).expect(404);
    const list = await api('get', '/dealer/rfqs', outsider).expect(200);
    expect(
      list.body.data.items.some((item: { id: string }) => item.id === id),
    ).toBe(false);
    await accept(id, viewer).expect(403);
    const order = await accept(id, buyer).expect(201);
    await api(
      'patch',
      `/dealer/purchase-orders/${order.body.data.id}/cancel`,
      outsider,
    )
      .send({ reason: 'Procurement requirements changed' })
      .expect(404);
  });
  it('requires MFA on every admin write and limits price-book rules to assigned companies', async () => {
    const created = await api('post', '/admin/b2b/price-books', staff)
      .set('x-mfa-code', await mfa())
      .send({ code: `BOOK-${suffix}`, label: 'Test book' })
      .expect(201);
    bookId = created.body.data.id;
    await prisma.pricingRule.create({
      data: { variantId, scope: 'PRICE_TABLE', bookId, priceCents: 700 },
    });
    for (const path of [
      '/admin/b2b/price-books',
      '/admin/b2b/rfqs/unknown/quotes',
    ])
      await api('post', path, staff).send({}).expect(403);
    await api('put', `/admin/b2b/companies/${companyId}/price-books`, staff)
      .send({ bookIds: [bookId] })
      .expect(403);
    await api('patch', '/admin/b2b/purchase-orders/unknown/status', staff)
      .send({ status: 'CONFIRMED' })
      .expect(403);
    const before = await api('post', '/dealer/quick-order/validate')
      .send({ lines: [{ sku, quantity: 1 }] })
      .expect(201);
    expect(before.body.data.results[0].unitPriceCents).toBe(2000);
    await api('put', `/admin/b2b/companies/${companyId}/price-books`, staff)
      .set('x-mfa-code', await mfa())
      .send({ bookIds: [bookId] })
      .expect(200);
    const after = await api('post', '/dealer/quick-order/validate')
      .send({ lines: [{ sku, quantity: 1 }] })
      .expect(201);
    expect(after.body.data.results[0]).toMatchObject({
      unitPriceCents: 700,
      priceSource: 'PRICE_TABLE',
    });
    const catalog = await api('get', '/dealer/catalog').expect(200);
    expect(
      catalog.body.data
        .find((item: { id: string }) => item.id === productId)
        .variants.find((item: { sku: string }) => item.sku === sku).price
        .priceCents,
    ).toBe(700);
    const foreign = await api('post', '/dealer/quick-order/validate', outsider)
      .send({ lines: [{ sku, quantity: 1 }] })
      .expect(201);
    expect(foreign.body.data.results[0].unitPriceCents).toBe(2000);
    await api('put', `/admin/b2b/companies/${companyId}/price-books`, staff)
      .set('x-mfa-code', await mfa())
      .send({ bookIds: [] })
      .expect(200);
    const revoked = await api('post', '/dealer/quick-order/validate')
      .send({ lines: [{ sku, quantity: 1 }] })
      .expect(201);
    expect(revoked.body.data.results[0].unitPriceCents).toBe(2000);
  });
  it('filters exact product lookup by company authorization and exposes only effective company quantity tiers', async () => {
    const tiers = await Promise.all([
      prisma.pricingRule.create({
        data: {
          variantId,
          scope: 'COMPANY_SPECIFIC',
          companyId,
          priceCents: 1500,
          minQty: 5,
          market: 'US',
          currency: 'USD',
        },
      }),
      prisma.pricingRule.create({
        data: {
          variantId,
          scope: 'COMPANY_SPECIFIC',
          companyId: otherCompanyId,
          priceCents: 111,
          minQty: 9,
          market: 'US',
          currency: 'USD',
        },
      }),
      prisma.pricingRule.create({
        data: {
          variantId,
          scope: 'COMPANY_SPECIFIC',
          companyId,
          priceCents: 222,
          minQty: 10,
          market: 'CA',
          currency: 'USD',
        },
      }),
      prisma.pricingRule.create({
        data: {
          variantId,
          scope: 'COMPANY_SPECIFIC',
          companyId,
          priceCents: 333,
          minQty: 12,
          market: 'US',
          currency: 'USD',
          endsAt: new Date(Date.now() - 60000),
        },
      }),
    ]);
    try {
      const result = await api(
        'get',
        '/dealer/catalog?productId=' + productId,
      ).expect(200);
      expect(result.body.data).toHaveLength(1);
      expect(
        result.body.data[0].variants.find(
          (v: { id: string }) => v.id === variantId,
        ).priceBreaks,
      ).toEqual([
        { minQty: 1, priceCents: 2000, currency: 'USD' },
        { minQty: 5, priceCents: 1500, currency: 'USD' },
      ]);
      const tier = await api(
        'get',
        '/dealer/catalog?productId=' + productId + '&quantity=5',
      ).expect(200);
      expect(
        tier.body.data[0].variants.find(
          (v: { id: string }) => v.id === variantId,
        ).price.priceCents,
      ).toBe(1500);
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { b2bDefaultPriceCents: null },
      });
      const thresholdOnly = await api(
        'get',
        '/dealer/catalog?productId=' + productId,
      ).expect(200);
      expect(
        thresholdOnly.body.data[0].variants.find(
          (v: { id: string }) => v.id === variantId,
        ),
      ).toMatchObject({ quantity: 5, price: { priceCents: 1500 } });
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { catalogPolicy: { productIds: ['unrelated-product'] } },
      });
      expect(
        (await api('get', '/dealer/catalog?productId=' + productId).expect(200))
          .body.data,
      ).toEqual([]);
    } finally {
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { b2bDefaultPriceCents: 2000 },
      });
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { catalogPolicy: {} },
      });
      await prisma.pricingRule.deleteMany({
        where: { id: { in: tiers.map((tier) => tier.id) } },
      });
    }
  });

  it('preserves quote history and refuses stale versions or stale quote edits', async () => {
    const id = await quoted();
    const dto = {
      revision: 1,
      lines: [{ sku, unitPriceCents: 1200 }],
      taxCents: 0,
      shippingCents: 0,
      validUntil: future(),
    };
    await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff)
      .set('x-mfa-code', await mfa())
      .send(dto)
      .expect(201);
    await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff)
      .set('x-mfa-code', await mfa())
      .send(dto)
      .expect(409);
    await accept(id).expect(409);
    const order = await accept(id, owner, 2).expect(201);
    expect(order.body.data.totalCents).toBe(2400);
    expect(await prisma.dealerQuote.count({ where: { rfqId: id } })).toBe(2);
    expect(
      (
        await prisma.dealerQuote.findUniqueOrThrow({
          where: { rfqId_version: { rfqId: id, version: 1 } },
        })
      ).totalCents,
    ).toBe(3300);
  });
  it('rejects expired quotes and exposes EXPIRED in the workbench', async () => {
    const id = await quoted();
    await prisma.dealerQuote.updateMany({
      where: { rfqId: id },
      data: { validUntil: new Date(Date.now() - 1000) },
    });
    await accept(id).expect(409);
    const list = await api('get', '/dealer/rfqs').expect(200);
    expect(
      list.body.data.items.find((item: { id: string }) => item.id === id)
        .status,
    ).toBe('EXPIRED');
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 20, reserved: 0 });
  });
  it('serializes concurrent accept requests into one PO and one reservation, preserving snapshots', async () => {
    const id = await quoted();
    await prisma.product.update({
      where: { id: productId },
      data: { name: 'Changed live name' },
    });
    const responses = await Promise.all([accept(id), accept(id)]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[0].body.data.id).toBe(responses[1].body.data.id);
    expect(responses[0].body.data).toMatchObject({
      totalCents: 3300,
      shippingAddress: address,
      items: [
        { productName: 'B2B test product', unitPriceCents: 1500, quantity: 2 },
      ],
    });
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 18, reserved: 2 });
    expect(await prisma.purchaseOrder.count({ where: { rfqId: id } })).toBe(1);
    await prisma.product.update({
      where: { id: productId },
      data: { name: 'B2B test product' },
    });
  });
  it('rolls back all lines if a later SKU runs out of stock', async () => {
    const id = await quoted([
      { sku, quantity: 2 },
      { sku: `${sku}-SECOND`, quantity: 2 },
    ]);
    await prisma.stock.update({
      where: { variantId: secondVariantId },
      data: { available: 0 },
    });
    await accept(id).expect(409);
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 20, reserved: 0 });
    expect(await prisma.purchaseOrder.count({ where: { rfqId: id } })).toBe(0);
    expect(await prisma.dealerRfq.findUnique({ where: { id } })).toMatchObject({
      status: 'QUOTED',
    });
  });
  it('prevents overselling across concurrent RFQs', async () => {
    const first = await quoted(),
      second = await quoted();
    await prisma.stock.update({ where: { variantId }, data: { available: 2 } });
    const results = await Promise.all([accept(first), accept(second)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 0, reserved: 2 });
  });
  it('cancels only pending POs and restores inventory once', async () => {
    const id = await quoted();
    const order = await accept(id).expect(201);
    const po = order.body.data.id;
    await api('patch', `/dealer/purchase-orders/${po}/cancel`)
      .send({ reason: 'Procurement requirements changed' })
      .expect(200);
    await api('patch', `/dealer/purchase-orders/${po}/cancel`)
      .send({ reason: 'Procurement requirements changed' })
      .expect(409);
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 20, reserved: 0 });
    const retry = await accept(id).expect(201);
    expect(retry.body.data.status).toBe('CANCELLED');
    expect(
      await prisma.auditLog.count({
        where: { entityId: po, action: 'dealer.po.transition' },
      }),
    ).toBe(1);
  });
  it('enforces fulfillment sequence and consumes reservations at shipment only', async () => {
    const id = await quoted();
    const order = await accept(id).expect(201);
    const po = order.body.data.id;
    const transition = async (status: string, expected = 200) =>
      api('patch', `/admin/b2b/purchase-orders/${po}/status`, staff)
        .set('x-mfa-code', await mfa())
        .send({
          status,
          reason:
            status === 'CANCELLED'
              ? 'Procurement requirements changed'
              : undefined,
        })
        .expect(expected);
    await transition('SHIPPED', 409);
    await transition('CONFIRMED');
    await api('patch', `/dealer/purchase-orders/${po}/cancel`)
      .send({ reason: 'Procurement requirements changed' })
      .expect(409);
    await transition('PROCESSING');
    await transition('SHIPPED', 409);
    await api('post', `/admin/b2b/purchase-orders/${po}/shipments`, staff)
      .set('x-mfa-code', await mfa())
      .send({
        carrier: 'Test courier',
        trackingNumber: 'FULL-TRACK',
        dedupeKey: randomUUID(),
        lines: [{ sku, quantity: 2 }],
      })
      .expect(201);
    await transition('COMPLETED');
    await transition('CANCELLED', 409);
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 18, reserved: 0 });
  });
  it('rejects unknown/duplicate quotation lines, overflow totals and terminal RFQ writes', async () => {
    const id = await quoted();
    for (const lines of [
      [{ sku: 'UNKNOWN', unitPriceCents: 1 }],
      [{ sku, unitPriceCents: 2147483647 }],
      [
        { sku, unitPriceCents: 10 },
        { sku, unitPriceCents: 10 },
      ],
    ]) {
      await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff)
        .set('x-mfa-code', await mfa())
        .send({
          revision: 1,
          lines,
          taxCents: 0,
          shippingCents: 0,
          validUntil: future(),
        })
        .expect(422);
    }
    await api('post', `/dealer/rfqs/${id}/reject`)
      .send({
        version: 1,
        reason: 'Delivery window does not meet our requirement',
      })
      .expect(201);
    await accept(id).expect(409);
    await api('post', `/dealer/rfqs/${id}/submit`).send({}).expect(409);
  });
  it('enforces product and variant authorization after a quote exists, without reserving unauthorized stock', async () => {
    const id = await quoted();
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: { catalogPolicy: { variantIds: [secondVariantId] } },
    });
    try {
      const catalog = await api('get', '/dealer/catalog').expect(200);
      expect(JSON.stringify(catalog.body.data)).not.toContain(
        `"id":"${variantId}"`,
      );
      const preview = await api('post', '/dealer/quick-order/validate')
        .send({ lines: [{ sku, quantity: 2 }] })
        .expect(201);
      expect(preview.body.data.valid).toBe(false);
      await accept(id).expect(409);
      expect(
        await prisma.stock.findUnique({ where: { variantId } }),
      ).toMatchObject({ available: 20, reserved: 0 });
    } finally {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { catalogPolicy: {} },
      });
    }
  });
  it('validates CSV, MOQ and case quantities, hides precise stock and isolates saved carts', async () => {
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: {
        purchaseSettings: {
          moq: 6,
          multiple: 3,
          caseSize: 6,
          inventoryDisplay: 'STATUS',
          leadTimeDays: 7,
        },
      },
    });
    try {
      const bad = await api('post', '/dealer/quick-order/csv')
        .send({ csv: `sku,quantity\n${sku},3` })
        .expect(201);
      expect(bad.body.data.results[0].code).toBe('PURCHASE_RULE');
      const good = await api('post', '/dealer/quick-order/csv')
        .send({ csv: `sku,quantity\n${sku},6` })
        .expect(201);
      expect(good.body.data.results[0]).toMatchObject({
        ok: true,
        available: null,
        purchaseRules: { leadTimeDays: 7 },
      });
      await api('put', '/dealer/cart')
        .send({ lines: [{ sku, quantity: 6 }] })
        .expect(200);
      const mine = await api('get', '/dealer/cart').expect(200);
      expect(mine.body.data.lines).toHaveLength(1);
      const theirs = await api('get', '/dealer/cart', outsider).expect(200);
      expect(theirs.body.data.lines).toEqual([]);
      await api('put', '/dealer/cart', viewer)
        .send({ lines: [{ sku, quantity: 6 }] })
        .expect(403);
    } finally {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { purchaseSettings: {} },
      });
    }
  });
  it('enforces independent market allocations and releases the original market after company changes', async () => {
    const id = await quoted();
    await prisma.marketInventory.createMany({
      data: [
        { variantId, market: 'US', available: 1 },
        { variantId, market: 'CA', available: 5 },
      ],
    });
    try {
      const preview = await api('post', '/dealer/quick-order/validate')
        .send({ lines: [{ sku, quantity: 2 }] })
        .expect(201);
      expect(preview.body.data.results[0].code).toBe('INSUFFICIENT_STOCK');
      await accept(id).expect(409);
      await prisma.marketInventory.update({
        where: { variantId_market: { variantId, market: 'US' } },
        data: { available: 3 },
      });
      const accepted = await accept(id).expect(201);
      expect(accepted.body.data.market).toBe('US');
      expect(
        await prisma.marketInventory.findUnique({
          where: { variantId_market: { variantId, market: 'US' } },
        }),
      ).toMatchObject({ available: 1, reserved: 2 });
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { country: 'CA' },
      });
      await api(
        'patch',
        `/dealer/purchase-orders/${accepted.body.data.id}/cancel`,
      )
        .send({ reason: 'Procurement requirements changed' })
        .expect(200);
      expect(
        await prisma.marketInventory.findUnique({
          where: { variantId_market: { variantId, market: 'US' } },
        }),
      ).toMatchObject({ available: 3, reserved: 0 });
      expect(
        await prisma.marketInventory.findUnique({
          where: { variantId_market: { variantId, market: 'CA' } },
        }),
      ).toMatchObject({ available: 5, reserved: 0 });
      expect(
        await prisma.stock.findUnique({ where: { variantId } }),
      ).toMatchObject({ available: 20, reserved: 0 });
    } finally {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { country: 'US' },
      });
      await prisma.marketInventory.deleteMany({ where: { variantId } });
    }
  });

  it('supports reservation at staff confirmation and audited commercial adjustments without rewriting quote totals', async () => {
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: { purchaseSettings: { reserveAt: 'CONFIRM' } },
    });
    try {
      const rfq = await quoted();
      const placed = await accept(rfq).expect(201);
      const po = placed.body.data.id;
      expect(placed.body.data.inventoryReserved).toBe(false);
      expect(
        await prisma.stock.findUnique({ where: { variantId } }),
      ).toMatchObject({ available: 20, reserved: 0 });
      await prisma.stock.update({
        where: { variantId },
        data: { available: 1 },
      });
      await api('patch', `/admin/b2b/purchase-orders/${po}/status`, staff)
        .set('x-mfa-code', await mfa())
        .send({ status: 'CONFIRMED' })
        .expect(409);
      await prisma.stock.update({
        where: { variantId },
        data: { available: 10 },
      });
      await api('patch', `/admin/b2b/purchase-orders/${po}/status`, staff)
        .set('x-mfa-code', await mfa())
        .send({ status: 'CONFIRMED' })
        .expect(200);
      expect(
        await prisma.stock.findUnique({ where: { variantId } }),
      ).toMatchObject({ available: 8, reserved: 2 });
      const changed = await api(
        'patch',
        `/admin/b2b/purchase-orders/${po}/adjust`,
        staff,
      )
        .set('x-mfa-code', await mfa())
        .send({
          reason: 'Customer requested new delivery location',
          customerPoNumber: 'REVISED-PO',
          shippingAddress: { ...address, city: 'Seattle' },
        })
        .expect(200);
      expect(changed.body.data).toMatchObject({
        totalCents: placed.body.data.totalCents,
        quoteVersion: 1,
        customerPoNumber: 'REVISED-PO',
        shippingAddress: { city: 'Seattle' },
        inventoryReserved: true,
      });
      expect(changed.body.data.adjustments[0].reason).toBe(
        'Customer requested new delivery location',
      );
      await api('patch', `/admin/b2b/purchase-orders/${po}/adjust`, outsider)
        .send({ reason: 'wrong company', customerPoNumber: 'NO' })
        .expect(403);
      const otherRfq = await quoted();
      const otherPo = (await accept(otherRfq).expect(201)).body.data.id;
      await api('patch', `/dealer/purchase-orders/${otherPo}/cancel`)
        .send({})
        .expect(400);
      const cancelled = await api(
        'patch',
        `/dealer/purchase-orders/${otherPo}/cancel`,
      )
        .send({ reason: 'No longer required' })
        .expect(200);
      expect(cancelled.body.data).toMatchObject({
        cancellationReason: 'No longer required',
        inventoryReserved: false,
      });
      expect(
        await prisma.stock.findUnique({ where: { variantId } }),
      ).toMatchObject({ available: 8, reserved: 2 });
    } finally {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { purchaseSettings: {} },
      });
    }
  });

  it('retains partial shipment quantities, prevents overshipping, generates PDF and revalidates reorders', async () => {
    const rfq = await quoted([{ sku, quantity: 4 }]);
    const accepted = await accept(rfq).expect(201);
    const po = accepted.body.data.id;
    await api('patch', `/admin/b2b/purchase-orders/${po}/status`, staff)
      .set('x-mfa-code', await mfa())
      .send({ status: 'CONFIRMED' })
      .expect(200);
    const ship = {
      carrier: 'Test courier',
      trackingNumber: 'TRACK-1',
      dedupeKey: randomUUID(),
      lines: [{ sku, quantity: 1 }],
    };
    const first = await api(
      'post',
      `/admin/b2b/purchase-orders/${po}/shipments`,
      staff,
    )
      .set('x-mfa-code', await mfa())
      .send(ship)
      .expect(201);
    const replay = await api(
      'post',
      `/admin/b2b/purchase-orders/${po}/shipments`,
      staff,
    )
      .set('x-mfa-code', await mfa())
      .send(ship)
      .expect(201);
    expect(replay.body.data.id).toBe(first.body.data.id);
    expect(
      await prisma.stock.findUnique({ where: { variantId } }),
    ).toMatchObject({ available: 16, reserved: 3 });
    await api('post', `/admin/b2b/purchase-orders/${po}/shipments`, staff)
      .set('x-mfa-code', await mfa())
      .send({ ...ship, dedupeKey: randomUUID(), lines: [{ sku, quantity: 4 }] })
      .expect(422);
    await api('post', `/admin/b2b/purchase-orders/${po}/shipments`, staff)
      .set('x-mfa-code', await mfa())
      .send({
        ...ship,
        dedupeKey: randomUUID(),
        trackingNumber: 'TRACK-2',
        lines: [{ sku, quantity: 3 }],
      })
      .expect(201);
    expect(
      await prisma.purchaseOrder.findUnique({ where: { id: po } }),
    ).toMatchObject({ status: 'SHIPPED' });
    const document = await api(
      'get',
      `/dealer/purchase-orders/${po}/documents/packing-list`,
    ).expect(200);
    expect(
      Buffer.from(document.body.data.base64, 'base64')
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    await api(
      'get',
      `/dealer/purchase-orders/${po}/documents/invoice`,
      outsider,
    ).expect(404);
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED' },
    });
    try {
      const reorder = await api('post', `/dealer/purchase-orders/${po}/reorder`)
        .send({})
        .expect(201);
      expect(reorder.body.data.valid).toBe(false);
    } finally {
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'ACTIVE' },
      });
    }
  });
  it('requires company customer PO number and preserves negotiated payment/billing terms', async () => {
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: {
        purchaseSettings: { requirePoNumber: true, paymentMethods: ['PO'] },
      },
    });
    try {
      const id = await quoted();
      await accept(id).expect(422);
      const order = await api('post', `/dealer/rfqs/${id}/accept`)
        .send({
          version: 1,
          shippingAddress: address,
          billingAddress: { ...address, city: 'New York' },
          customerPoNumber: 'CUSTOMER-2026-001',
          paymentMethod: 'PO',
        })
        .expect(201);
      expect(order.body.data).toMatchObject({
        customerPoNumber: 'CUSTOMER-2026-001',
        paymentMethod: 'PO',
        billingAddress: { city: 'New York' },
      });
    } finally {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { purchaseSettings: {} },
      });
    }
  });
  it('grants registered files but keeps company downloads and qualification files private', async () => {
    const files = await prisma.mediaAsset.createManyAndReturn({
      data: [
        {
          key: `test-reg-${suffix}`,
          fileName: 'registered.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          visibility: 'REGISTERED',
        },
        {
          key: `test-company-${suffix}`,
          fileName: 'company.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          visibility: 'DEALER_ONLY',
          companyIds: [companyId],
        },
        {
          key: `test-qualification-${suffix}`,
          fileName: 'qualification.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          visibility: 'DEALER_ONLY',
          qualification: true,
        },
      ],
    });
    try {
      const own = await api('get', '/media/downloads').expect(200);
      expect(own.body.data.map((f: { id: string }) => f.id)).toContain(
        files[1].id,
      );
      expect(own.body.data.map((f: { id: string }) => f.id)).not.toContain(
        files[2].id,
      );
      await api('get', `/media/${files[0].id}/access`, outsider).expect(200);
      await api('get', `/media/${files[1].id}/access`, outsider).expect(403);
      await api('get', `/media/${files[2].id}/access`).expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/media/${files[1].id}/download`)
        .expect(403);
    } finally {
      await prisma.mediaAsset.deleteMany({
        where: { id: { in: files.map((f) => f.id) } },
      });
    }
  });
  it('does not reserve stale inventory when an upstream synchronization fails', async () => {
    const id = await quoted();
    await prisma.stock.update({
      where: { variantId },
      data: { syncError: 'upstream temporarily unavailable' },
    });
    try {
      const catalog = await api('get', '/dealer/catalog').expect(200);
      const variant = catalog.body.data
        .flatMap((p: { variants: Array<{ id: string }> }) => p.variants)
        .find((v: { id: string }) => v.id === variantId);
      expect(variant).toMatchObject({
        availability: 'CHECK_AVAILABILITY',
        available: null,
      });
      const preview = await api('post', '/dealer/quick-order/validate')
        .send({ lines: [{ sku, quantity: 2 }] })
        .expect(201);
      expect(preview.body.data.results[0].code).toBe('CHECK_AVAILABILITY');
      await accept(id).expect(409);
      expect(
        await prisma.stock.findUnique({ where: { variantId } }),
      ).toMatchObject({ available: 20, reserved: 0 });
    } finally {
      await prisma.stock.update({
        where: { variantId },
        data: { syncError: null },
      });
    }
  });
  it('keeps card payment tenant-scoped, verifies webhook signatures and amount, and deduplicates terminal payment events', async () => {
    const oldMode = process.env.B2B_PAYMENT_MODE,
      oldSecret = process.env.B2B_PAYMENT_WEBHOOK_SECRET;
    process.env.B2B_PAYMENT_MODE = 'DEMO';
    process.env.B2B_PAYMENT_WEBHOOK_SECRET = 'b2b-local-webhook-test-secret';
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: { purchaseSettings: { paymentMethods: ['CARD'] } },
    });
    try {
      const id = await quoted();
      const accepted = await api('post', `/dealer/rfqs/${id}/accept`)
        .send({ version: 1, shippingAddress: address, paymentMethod: 'CARD' })
        .expect(201);
      const po = accepted.body.data.id;
      await api('patch', `/admin/b2b/purchase-orders/${po}/status`, staff)
        .set('x-mfa-code', await mfa())
        .send({ status: 'CONFIRMED' })
        .expect(409);
      await api(
        'post',
        `/dealer/purchase-orders/${po}/payment-session`,
        outsider,
      )
        .send({ idempotencyKey: randomUUID() })
        .expect(409);
      const key = randomUUID();
      const session = await api(
        'post',
        `/dealer/purchase-orders/${po}/payment-session`,
      )
        .send({ idempotencyKey: key })
        .expect(201);
      const payment = session.body.data;
      const repeat = await api(
        'post',
        `/dealer/purchase-orders/${po}/payment-session`,
      )
        .send({ idempotencyKey: key })
        .expect(201);
      expect(repeat.body.data.id).toBe(payment.id);
      await prisma.purchaseOrderPayment.update({
        where: { id: payment.id },
        data: { mode: 'WEBHOOK' },
      });
      const event = {
        eventId: randomUUID(),
        paymentId: payment.id,
        status: 'SUCCEEDED',
        amountCents: payment.amountCents,
        currency: payment.currency,
        providerReference: 'TEST-PSP-1',
      };
      const call = (payload = event, signature?: string) => {
        const timestamp = String(Date.now());
        return request(app.getHttpServer())
          .post('/api/v1/dealer/payments/webhook')
          .set('x-payment-timestamp', timestamp)
          .set(
            'x-payment-signature',
            signature ??
              signPayment(
                payload,
                timestamp,
                process.env.B2B_PAYMENT_WEBHOOK_SECRET!,
              ),
          )
          .send(payload);
      };
      await call(event, '0'.repeat(64)).expect(409);
      await call({ ...event, amountCents: event.amountCents + 1 }).expect(409);
      await call().expect(201);
      const duplicate = await call().expect(201);
      expect(duplicate.body.data.duplicate).toBe(true);
      await call({ ...event, currency: 'EUR' }).expect(409);
      expect(
        await prisma.purchaseOrder.findUnique({ where: { id: po } }),
      ).toMatchObject({ paymentStatus: 'PAID', status: 'PENDING_REVIEW' });
      await api('patch', `/admin/b2b/purchase-orders/${po}/status`, staff)
        .set('x-mfa-code', await mfa())
        .send({ status: 'CONFIRMED' })
        .expect(200);
    } finally {
      await prisma.dealerCompany.update({
        where: { id: companyId },
        data: { purchaseSettings: {} },
      });
      if (oldMode === undefined) delete process.env.B2B_PAYMENT_MODE;
      else process.env.B2B_PAYMENT_MODE = oldMode;
      if (oldSecret === undefined)
        delete process.env.B2B_PAYMENT_WEBHOOK_SECRET;
      else process.env.B2B_PAYMENT_WEBHOOK_SECRET = oldSecret;
    }
  });
});

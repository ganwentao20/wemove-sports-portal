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
  let companyId = '', otherCompanyId = '', productId = '', variantId = '', secondVariantId = '', staffId = '', bookId = '';
  const users: string[] = [];
  let owner = '', buyer = '', viewer = '', outsider = '', staff = '';
  const sku = `B2B-${suffix.toUpperCase()}`;
  const address = { recipient: 'Procurement Tester', phone: '+1 555 0100', country: 'US', city: 'Boston', addressLine: '10 Test Street', postalCode: '02101' };
  const api = (method: 'get' | 'post' | 'patch' | 'put', path: string, token = owner) => request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const mfa = () => generate({ secret });
  const future = () => new Date(Date.now() + 3600000).toISOString();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); await setupApp(app); await app.init();
    const jwt = app.get(JwtService);
    const company = await prisma.dealerCompany.create({ data: { companyName: 'B2B test', legalRegNo: `B2B-${suffix}`, country: 'US', status: 'APPROVED' } }); companyId = company.id;
    const other = await prisma.dealerCompany.create({ data: { companyName: 'Other test', legalRegNo: `OTHER-${suffix}`, country: 'US', status: 'APPROVED' } }); otherCompanyId = other.id;
    async function member(role: 'OWNER' | 'BUYER' | 'VIEWER', tenant = companyId) {
      const user = await prisma.user.create({ data: { email: `${suffix}-${users.length}@b2b.test`, name: role, ageConfirmed: true, passwordHash: 'unused-test-password-hash', status: 'ACTIVE', dealerMembers: { create: { companyId: tenant, role } } } }); users.push(user.id);
      return jwt.signAsync({ sub: user.id, kind: 'customer', companyId: tenant, email: user.email, name: user.name }, { secret: process.env.JWT_ACCESS_SECRET });
    }
    owner = await member('OWNER'); buyer = await member('BUYER'); viewer = await member('VIEWER'); outsider = await member('OWNER', otherCompanyId);
    const admin = await prisma.staff.create({ data: { email: `${suffix}@b2b-admin.test`, name: 'B2B Admin', passwordHash: 'unused', mfaEnabled: true, mfaSecret: secret } }); staffId = admin.id;
    staff = await jwt.signAsync({ sub: admin.id, kind: 'staff', roles: ['SUPER_ADMIN'], email: admin.email, name: admin.name }, { secret: process.env.JWT_ACCESS_SECRET });
    const product = await prisma.product.create({ data: { name: 'B2B test product', slug: `b2b-${suffix}`, status: 'ACTIVE', variants: { create: [{ sku, b2bDefaultPriceCents: 2000, stock: { create: { available: 20 } } }, { sku: `${sku}-SECOND`, b2bDefaultPriceCents: 1800, stock: { create: { available: 20 } } }] } }, include: { variants: true } });
    productId = product.id; variantId = product.variants.find(item => item.sku === sku)!.id; secondVariantId = product.variants.find(item => item.sku !== sku)!.id;
  });
  beforeEach(async () => { await prisma.stock.updateMany({ where: { variantId: { in: [variantId, secondVariantId] } }, data: { available: 20, reserved: 0 } }); });
  afterAll(async () => {
    await prisma.purchaseOrder.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.dealerRfq.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    if (bookId) await prisma.priceBook.delete({ where: { id: bookId } });
    await prisma.dealerCompany.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (staffId) await prisma.staff.delete({ where: { id: staffId } });
    await prisma.$disconnect(); await app?.close();
  });
  async function draft(lines = [{ sku, quantity: 2 }]) {
    const created = await api('post', '/dealer/rfqs').send({ title: `Restock ${suffix}`, lines }).expect(201);
    return created.body.data.id as string;
  }
  async function quoted(lines = [{ sku, quantity: 2 }]) {
    const id = await draft(lines);
    await api('post', `/dealer/rfqs/${id}/submit`).send({}).expect(201);
    await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff).set('x-mfa-code', await mfa()).send({ revision: 0, lines: lines.map(item => ({ sku: item.sku, unitPriceCents: 1500 })), taxCents: 100, shippingCents: 200, validUntil: future() }).expect(201);
    return id;
  }
  const accept = (id: string, token = owner, version = 1) => api('post', `/dealer/rfqs/${id}/accept`, token).send({ version, shippingAddress: address });

  it('enforces anonymous, customer/staff and VIEWER boundaries', async () => {
    await request(app.getHttpServer()).get('/api/v1/dealer/rfqs').expect(401);
    await api('get', '/dealer/rfqs', staff).expect(403);
    await api('get', '/admin/b2b/rfqs').expect(403);
    await api('post', '/dealer/rfqs', viewer).send({ title: 'Forbidden', lines: [{ sku, quantity: 1 }] }).expect(403);
    await api('get', '/dealer/rfqs', viewer).expect(200);
  });
  it('rejects empty/oversize/duplicate rows and missing delivery details', async () => {
    for (const lines of [[], [{ sku, quantity: 0 }], [{ sku, quantity: 1 }, { sku, quantity: 2 }]]) {
      const response = await api('post', '/dealer/rfqs').send({ title: 'Invalid', lines }); expect(response.status).toBeGreaterThanOrEqual(400);
    }
    const id = await quoted();
    await api('post', `/dealer/rfqs/${id}/accept`).send({ version: 1 }).expect(400);
    expect(await prisma.purchaseOrder.count({ where: { rfqId: id } })).toBe(0);
  });
  it('uses live membership and company status instead of stale JWT claims', async () => {
    await prisma.dealerMember.update({ where: { companyId_userId: { companyId, userId: users[1] } }, data: { role: 'VIEWER' } });
    await api('post', '/dealer/rfqs', buyer).send({ title: 'Revoked buyer', lines: [{ sku, quantity: 1 }] }).expect(403);
    await prisma.dealerMember.update({ where: { companyId_userId: { companyId, userId: users[1] } }, data: { role: 'BUYER' } });
    await prisma.dealerCompany.update({ where: { id: companyId }, data: { status: 'SUSPENDED' } });
    await api('get', '/dealer/rfqs').expect(403);
    await api('get', '/dealer/catalog').expect(403);
    await prisma.dealerCompany.update({ where: { id: companyId }, data: { status: 'APPROVED' } });
  });
  it('isolates other companies from RFQ actions and purchase orders', async () => {
    const id = await quoted();
    await accept(id, outsider).expect(404);
    const list = await api('get', '/dealer/rfqs', outsider).expect(200); expect(list.body.data.items.some((item: { id: string }) => item.id === id)).toBe(false);
    await accept(id, viewer).expect(403);
    const order = await accept(id, buyer).expect(201);
    await api('patch', `/dealer/purchase-orders/${order.body.data.id}/cancel`, outsider).send({}).expect(404);
  });
  it('requires MFA on every admin write and limits price-book rules to assigned companies', async () => {
    const created = await api('post', '/admin/b2b/price-books', staff).set('x-mfa-code', await mfa()).send({ code: `BOOK-${suffix}`, label: 'Test book' }).expect(201); bookId = created.body.data.id;
    await prisma.pricingRule.create({ data: { variantId, scope: 'PRICE_TABLE', bookId, priceCents: 700 } });
    for (const path of ['/admin/b2b/price-books', '/admin/b2b/rfqs/unknown/quotes']) await api('post', path, staff).send({}).expect(403);
    await api('put', `/admin/b2b/companies/${companyId}/price-books`, staff).send({ bookIds: [bookId] }).expect(403);
    await api('patch', '/admin/b2b/purchase-orders/unknown/status', staff).send({ status: 'CONFIRMED' }).expect(403);
    const before = await api('post', '/dealer/quick-order/validate').send({ lines: [{ sku, quantity: 1 }] }).expect(201); expect(before.body.data.results[0].unitPriceCents).toBe(2000);
    await api('put', `/admin/b2b/companies/${companyId}/price-books`, staff).set('x-mfa-code', await mfa()).send({ bookIds: [bookId] }).expect(200);
    const after = await api('post', '/dealer/quick-order/validate').send({ lines: [{ sku, quantity: 1 }] }).expect(201); expect(after.body.data.results[0]).toMatchObject({ unitPriceCents: 700, priceSource: 'PRICE_TABLE' });
    const catalog = await api('get', '/dealer/catalog').expect(200); expect(catalog.body.data.find((item: { id: string }) => item.id === productId).variants.find((item: { sku: string }) => item.sku === sku).price.priceCents).toBe(700);
    const foreign = await api('post', '/dealer/quick-order/validate', outsider).send({ lines: [{ sku, quantity: 1 }] }).expect(201); expect(foreign.body.data.results[0].unitPriceCents).toBe(2000);
    await api('put', `/admin/b2b/companies/${companyId}/price-books`, staff).set('x-mfa-code', await mfa()).send({ bookIds: [] }).expect(200);
    const revoked = await api('post', '/dealer/quick-order/validate').send({ lines: [{ sku, quantity: 1 }] }).expect(201); expect(revoked.body.data.results[0].unitPriceCents).toBe(2000);
  });
  it('preserves quote history and refuses stale versions or stale quote edits', async () => {
    const id = await quoted();
    const dto = { revision: 1, lines: [{ sku, unitPriceCents: 1200 }], taxCents: 0, shippingCents: 0, validUntil: future() };
    await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff).set('x-mfa-code', await mfa()).send(dto).expect(201);
    await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff).set('x-mfa-code', await mfa()).send(dto).expect(409);
    await accept(id).expect(409);
    const order = await accept(id, owner, 2).expect(201); expect(order.body.data.totalCents).toBe(2400);
    expect(await prisma.dealerQuote.count({ where: { rfqId: id } })).toBe(2);
    expect((await prisma.dealerQuote.findUniqueOrThrow({ where: { rfqId_version: { rfqId: id, version: 1 } } })).totalCents).toBe(3300);
  });
  it('rejects expired quotes and exposes EXPIRED in the workbench', async () => {
    const id = await quoted();
    await prisma.dealerQuote.updateMany({ where: { rfqId: id }, data: { validUntil: new Date(Date.now() - 1000) } });
    await accept(id).expect(409);
    const list = await api('get', '/dealer/rfqs').expect(200); expect(list.body.data.items.find((item: { id: string }) => item.id === id).status).toBe('EXPIRED');
    expect(await prisma.stock.findUnique({ where: { variantId } })).toMatchObject({ available: 20, reserved: 0 });
  });
  it('serializes concurrent accept requests into one PO and one reservation, preserving snapshots', async () => {
    const id = await quoted();
    await prisma.product.update({ where: { id: productId }, data: { name: 'Changed live name' } });
    const responses = await Promise.all([accept(id), accept(id)]); expect(responses.map(response => response.status)).toEqual([201, 201]);
    expect(responses[0].body.data.id).toBe(responses[1].body.data.id);
    expect(responses[0].body.data).toMatchObject({ totalCents: 3300, shippingAddress: address, items: [{ productName: 'B2B test product', unitPriceCents: 1500, quantity: 2 }] });
    expect(await prisma.stock.findUnique({ where: { variantId } })).toMatchObject({ available: 18, reserved: 2 });
    expect(await prisma.purchaseOrder.count({ where: { rfqId: id } })).toBe(1);
    await prisma.product.update({ where: { id: productId }, data: { name: 'B2B test product' } });
  });
  it('rolls back all lines if a later SKU runs out of stock', async () => {
    const id = await quoted([{ sku, quantity: 2 }, { sku: `${sku}-SECOND`, quantity: 2 }]);
    await prisma.stock.update({ where: { variantId: secondVariantId }, data: { available: 0 } });
    await accept(id).expect(409);
    expect(await prisma.stock.findUnique({ where: { variantId } })).toMatchObject({ available: 20, reserved: 0 });
    expect(await prisma.purchaseOrder.count({ where: { rfqId: id } })).toBe(0);
    expect(await prisma.dealerRfq.findUnique({ where: { id } })).toMatchObject({ status: 'QUOTED' });
  });
  it('prevents overselling across concurrent RFQs', async () => {
    const first = await quoted(), second = await quoted();
    await prisma.stock.update({ where: { variantId }, data: { available: 2 } });
    const results = await Promise.all([accept(first), accept(second)]); expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect(await prisma.stock.findUnique({ where: { variantId } })).toMatchObject({ available: 0, reserved: 2 });
  });
  it('cancels only pending POs and restores inventory once', async () => {
    const id = await quoted(); const order = await accept(id).expect(201); const po = order.body.data.id;
    await api('patch', `/dealer/purchase-orders/${po}/cancel`).send({}).expect(200);
    await api('patch', `/dealer/purchase-orders/${po}/cancel`).send({}).expect(409);
    expect(await prisma.stock.findUnique({ where: { variantId } })).toMatchObject({ available: 20, reserved: 0 });
    const retry = await accept(id).expect(201); expect(retry.body.data.status).toBe('CANCELLED');
    expect(await prisma.auditLog.count({ where: { entityId: po, action: 'dealer.po.transition' } })).toBe(1);
  });
  it('enforces fulfillment sequence and consumes reservations at shipment only', async () => {
    const id = await quoted(); const order = await accept(id).expect(201); const po = order.body.data.id;
    const transition = async (status: string, expected = 200) => api('patch', `/admin/b2b/purchase-orders/${po}/status`, staff).set('x-mfa-code', await mfa()).send({ status }).expect(expected);
    await transition('SHIPPED', 409); await transition('CONFIRMED');
    await api('patch', `/dealer/purchase-orders/${po}/cancel`).send({}).expect(409);
    await transition('PROCESSING'); await transition('SHIPPED'); await transition('COMPLETED'); await transition('CANCELLED', 409);
    expect(await prisma.stock.findUnique({ where: { variantId } })).toMatchObject({ available: 18, reserved: 0 });
  });
  it('rejects unknown/duplicate quotation lines, overflow totals and terminal RFQ writes', async () => {
    const id = await quoted();
    for (const lines of [[{ sku: 'UNKNOWN', unitPriceCents: 1 }], [{ sku, unitPriceCents: 2147483647 }], [{ sku, unitPriceCents: 10 }, { sku, unitPriceCents: 10 }]]) {
      await api('post', `/admin/b2b/rfqs/${id}/quotes`, staff).set('x-mfa-code', await mfa()).send({ revision: 1, lines, taxCents: 0, shippingCents: 0, validUntil: future() }).expect(422);
    }
    await api('post', `/dealer/rfqs/${id}/reject`).send({ version: 1 }).expect(201);
    await accept(id).expect(409); await api('post', `/dealer/rfqs/${id}/submit`).send({}).expect(409);
  });
});

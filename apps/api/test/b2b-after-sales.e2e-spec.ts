import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID, createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { generate, generateSecret } from 'otplib';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { B2bAfterSalesService } from '../src/dealer/b2b-after-sales.service.js';
import { authenticatedFixture } from './auth-session.js';
import { operationMetrics } from '../src/platform/reports.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Purchase order after-sales (DB, stock and provider HTTP)',
  () => {
    const prisma = new PrismaClient(),
      suffix = randomUUID().slice(0, 8),
      secret = generateSecret(),
      providerSecret = 'refund-qa-secret-' + suffix;
    let app: INestApplication,
      staff = '',
      owner = '',
      viewer = '',
      outsider = '',
      staffId = '',
      ownerId = '',
      companyId = '',
      otherCompanyId = '',
      server: Server,
      url = '';
    const userIds: string[] = [],
      productIds: string[] = [];
    const external = new Map<
      string,
      { reference: string; amountCents: number; currency: string }
    >();
    let failNext = false,
      wrongAmount = false,
      providerCalls = 0;
    const api = (
      method: 'get' | 'post' | 'patch',
      path: string,
      token = owner,
    ) =>
      request(app.getHttpServer())
        [method]('/api/v1' + path)
        .set('Authorization', 'Bearer ' + token);
    const admin = async (path: string, body: object) => {
      const code = await generate({ secret });
      return {
        expect: (status: number) =>
          api('post', path, staff)
            .set('x-mfa-code', code)
            .send(body)
            .expect(status),
      };
    };
    beforeAll(async () => {
      vi.stubEnv('B2B_REFUND_WORKER', 'false');
      vi.stubEnv('B2B_PAYMENT_WEBHOOK_SECRET', providerSecret);
      app = (
        await Test.createTestingModule({ imports: [AppModule] }).compile()
      ).createNestApplication();
      await setupApp(app);
      await app.init();
      const jwt = app.get(JwtService);
      const role = await prisma.role.upsert({
        where: { code: 'SUPER_ADMIN' },
        create: { code: 'SUPER_ADMIN', name: 'Super Admin' },
        update: {},
      });
      const person = await prisma.staff.create({
        data: {
          email: 'po-refund-staff-' + suffix + '@example.test',
          name: 'PO returns staff',
          passwordHash: 'unused',
          mfaEnabled: true,
          mfaSecret: secret,
          roles: { create: { roleId: role.id } },
        },
      });
      staffId = person.id;
      staff = await authenticatedFixture(prisma, jwt, person, 'staff');
      for (const label of ['owner', 'viewer', 'outsider']) {
        const user = await prisma.user.create({
          data: {
            email: 'po-refund-' + label + '-' + suffix + '@example.test',
            name: label,
            passwordHash: 'unused',
            status: 'ACTIVE',
            ageConfirmed: true,
          },
        });
        userIds.push(user.id);
        if (label !== 'viewer') {
          const company = await prisma.dealerCompany.create({
            data: {
              companyName: 'PO after-sales ' + label + ' ' + suffix,
              legalRegNo: 'PO-AS-' + label + '-' + suffix,
              country: 'US',
              status: 'APPROVED',
            },
          });
          if (label === 'owner') {
            companyId = company.id;
            ownerId = user.id;
          } else otherCompanyId = company.id;
        }
        await prisma.dealerMember.create({
          data: {
            companyId: label === 'outsider' ? otherCompanyId : companyId,
            userId: user.id,
            role: label === 'viewer' ? 'VIEWER' : 'OWNER',
            termsVersion: 'dealer-terms-2026-09',
            termsAcceptedAt: new Date(),
          },
        });
        const token = await authenticatedFixture(prisma, jwt, user, 'customer');
        if (label === 'owner') owner = token;
        else if (label === 'viewer') viewer = token;
        else outsider = token;
      }
      server = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          providerCalls++;
          const timestamp = String(req.headers['x-payment-timestamp']);
          expect(req.headers['x-payment-signature']).toBe(
            createHmac('sha256', providerSecret)
              .update(timestamp + '.' + body)
              .digest('hex'),
          );
          const data = JSON.parse(body);
          expect(req.headers['idempotency-key']).toBe(data.refundId);
          if (!external.has(data.refundId))
            external.set(data.refundId, {
              reference: 'provider-' + data.refundId,
              amountCents: data.amountCents,
              currency: data.currency,
            });
          if (failNext) {
            failNext = false;
            res.writeHead(503).end();
            return;
          }
          const saved = external.get(data.refundId)!;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'SUCCEEDED',
              providerReference: saved.reference,
              amountCents: wrongAmount
                ? saved.amountCents + 1
                : saved.amountCents,
              currency: saved.currency,
            }),
          );
        });
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const address = server.address();
      if (!address || typeof address === 'string') throw Error('port missing');
      url = 'http://127.0.0.1:' + address.port + '/refund';
      vi.stubEnv('B2B_PAYMENT_REFUND_URL', url);
    });
    afterAll(async () => {
      vi.unstubAllEnvs();
      await app?.close();
      if (server)
        await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.purchaseOrder.deleteMany({
        where: { companyId: { in: [companyId, otherCompanyId] } },
      });
      await prisma.dealerRfq.deleteMany({
        where: { companyId: { in: [companyId, otherCompanyId] } },
      });
      await prisma.dealerCompany.deleteMany({
        where: { id: { in: [companyId, otherCompanyId] } },
      });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [...userIds, staffId] } },
      });
      await prisma.accountPrivacyRequest.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (staffId) await prisma.staff.delete({ where: { id: staffId } });
      await prisma.$disconnect();
    });
    async function fixture(shipped = 0, mode = 'OFFLINE') {
      const id = randomUUID();
      const product = await prisma.product.create({
        data: {
          name: 'Returnable ' + id,
          slug: 'returnable-' + id,
          status: 'ACTIVE',
          variants: {
            create: {
              sku: 'RETURN-' + id,
              b2bDefaultPriceCents: 1000,
              stock: { create: { available: 6, reserved: 4 - shipped } },
            },
          },
        },
        include: { variants: true },
      });
      productIds.push(product.id);
      const variant = product.variants[0];
      await prisma.marketInventory.create({
        data: {
          variantId: variant.id,
          market: 'US',
          available: 6,
          reserved: 4 - shipped,
        },
      });
      const rfq = await prisma.dealerRfq.create({
        data: {
          companyId,
          createdById: ownerId,
          title: 'After-sales fixture',
          status: 'ACCEPTED',
          items: [],
        },
      });
      const order = await prisma.purchaseOrder.create({
        data: {
          orderNo: 'AS-' + id,
          companyId,
          companyName: 'After-sales company',
          createdById: ownerId,
          rfqId: rfq.id,
          quoteVersion: 1,
          status:
            shipped === 4
              ? 'SHIPPED'
              : shipped
                ? 'PROCESSING'
                : 'PENDING_REVIEW',
          shippingAddress: { country: 'US', city: 'Boston' },
          market: 'US',
          paymentMethod: mode === 'OFFLINE' ? 'BANK_TRANSFER' : 'CARD',
          paymentStatus: 'PAID',
          subtotalCents: 4000,
          taxCents: 100,
          shippingCents: 100,
          totalCents: 4200,
          items: {
            create: {
              variantId: variant.id,
              sku: variant.sku,
              productName: product.name,
              quantity: 4,
              shippedQuantity: shipped,
              unitPriceCents: 1000,
              lineCents: 4000,
            },
          },
          payments: {
            create: {
              idempotencyKey: 'payment-' + id,
              amountCents: 4200,
              currency: 'USD',
              mode,
              status: 'SUCCEEDED',
              providerReference: 'charge-' + id,
            },
          },
        },
        include: { items: true, payments: true },
      });
      return { order, variant };
    }
    const refundBody = (
      amountCents: number,
      extra: Record<string, unknown> = {},
    ) => ({
      idempotencyKey: randomUUID(),
      amountCents,
      reason: 'Procurement requirement changed',
      ...extra,
    });
    it('serializes refund balance holds, checks MFA and company roles, and rejects idempotency body changes', async () => {
      const { order } = await fixture();
      const path = '/dealer/purchase-orders/' + order.id + '/refunds';
      await api('post', path, viewer).send(refundBody(1000)).expect(403);
      await api('post', path, staff).send(refundBody(1000)).expect(403);
      await api(
        'get',
        '/dealer/purchase-orders/' + order.id + '/after-sales',
        staff,
      ).expect(403);
      await api(
        'get',
        '/dealer/purchase-orders/' + order.id + '/after-sales',
        outsider,
      ).expect(404);
      await api('post', path, outsider).send(refundBody(1000)).expect(404);
      const bodies = [refundBody(3000), refundBody(3000)];
      const responses = await Promise.all(
        bodies.map((body) => api('post', path).send(body)),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([201, 422]);
      const index = responses.findIndex((r) => r.status === 201),
        refund = responses[index].body.data;
      expect(
        (await api('post', path).send(bodies[index]).expect(201)).body.data.id,
      ).toBe(refund.id);
      await api('post', path)
        .send({ ...bodies[index], amountCents: 2000 })
        .expect(409);
      await api('post', '/admin/b2b/refunds/' + refund.id + '/decision', staff)
        .send({ decision: 'APPROVE', reason: 'Reviewed request' })
        .expect(403);
      await api('post', '/admin/b2b/refunds/' + refund.id + '/decision', owner)
        .send({ decision: 'APPROVE', reason: 'Reviewed request' })
        .expect(403);
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/decision', {
          decision: 'REJECT',
          reason: 'Duplicate purchase request is still needed',
        })
      ).expect(201);
      const next = await api('post', path).send(refundBody(4200)).expect(201);
      expect(next.body.data.amountCents).toBe(4200);
      const ownExport = (await api('get', '/account/export').expect(200)).body
        .data;
      expect(
        ownExport.afterSales.dealerRefunds.some(
          (r: { id: string }) => r.id === next.body.data.id,
        ),
      ).toBe(true);
      expect(JSON.stringify(ownExport.afterSales)).not.toContain(
        'idempotencyKey',
      );
      const otherExport = (
        await api('get', '/account/export', outsider).expect(200)
      ).body.data;
      expect(otherExport.afterSales.dealerRefunds).toEqual([]);
      await api('post', '/dealer/refunds/' + next.body.data.id + '/cancel')
        .send({ reason: 'Withdraw procurement adjustment' })
        .expect(201);
      const balance = (
        await api(
          'get',
          '/dealer/purchase-orders/' + order.id + '/after-sales',
        ).expect(200)
      ).body.data;
      expect(balance.heldCents).toBe(0);
      await (
        await admin('/admin/b2b/refunds/' + next.body.data.id + '/decision', {
          decision: 'APPROVE',
          reason: 'Withdraw procurement adjustment',
        })
      ).expect(409);
    });
    it('records offline full refunds once and releases the original market reservation only after the transfer is confirmed', async () => {
      const { order, variant } = await fixture();
      const refund = (
        await api('post', '/dealer/purchase-orders/' + order.id + '/refunds')
          .send(refundBody(4200, { cancelOrder: true }))
          .expect(201)
      ).body.data;
      await api(
        'patch',
        '/admin/b2b/purchase-orders/' + order.id + '/status',
        staff,
      )
        .set('x-mfa-code', await generate({ secret }))
        .send({ status: 'CONFIRMED' })
        .expect(409);
      const approved = await (
        await admin('/admin/b2b/refunds/' + refund.id + '/decision', {
          decision: 'APPROVE',
          reason: 'Full unshipped cancellation approved',
        })
      ).expect(201);
      expect(approved.body.data.status).toBe('AWAITING_OFFLINE');
      await api('post', '/dealer/refunds/' + refund.id + '/cancel')
        .send({ reason: 'Cannot withdraw reviewed refund' })
        .expect(409);
      expect(
        await prisma.stock.findUnique({ where: { variantId: variant.id } }),
      ).toMatchObject({ available: 6, reserved: 4 });
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/offline-confirm', {
          amountCents: 4000,
          providerReference: 'BANK-TRANSFER-1',
        })
      ).expect(422);
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/offline-confirm', {
          amountCents: 4200,
          providerReference: 'BANK-TRANSFER-1',
        })
      ).expect(201);
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/offline-confirm', {
          amountCents: 4200,
          providerReference: 'BANK-TRANSFER-1',
        })
      ).expect(201);
      expect(
        await prisma.purchaseOrder.findUnique({ where: { id: order.id } }),
      ).toMatchObject({
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        inventoryReserved: false,
        totalCents: 4200,
      });
      const sales = (await operationMetrics(prisma as PrismaService, true))
        .sales;
      const marketSales = sales.find((row) => {
        const value = row as Record<string, unknown>;
        return (
          value.channel === 'B2B' &&
          value.market === 'US' &&
          value.currency === 'USD'
        );
      });
      expect(
        Number(
          (marketSales as Record<string, unknown> | undefined)?.refundedCents,
        ),
      ).toBeGreaterThanOrEqual(4200);
      expect(
        await prisma.stock.findUnique({ where: { variantId: variant.id } }),
      ).toMatchObject({ available: 10, reserved: 0 });
      expect(
        await prisma.marketInventory.findUnique({
          where: { variantId_market: { variantId: variant.id, market: 'US' } },
        }),
      ).toMatchObject({ available: 10, reserved: 0 });
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/offline-confirm', {
          amountCents: 4200,
          providerReference: 'DIFFERENT-TRANSFER',
        })
      ).expect(409);
    });
    it('validates shipped return capacity, approval and exact receipt, then refunds within the received item value', async () => {
      const { order, variant } = await fixture(2);
      const body = {
        idempotencyKey: randomUUID(),
        reason: 'One unit damaged and one incorrect size',
        lines: [{ orderItemId: order.items[0].id, quantity: 2 }],
      };
      const returned = await api(
        'post',
        '/dealer/purchase-orders/' + order.id + '/returns',
      )
        .send(body)
        .expect(201);
      const id = returned.body.data.id;
      await api('post', '/dealer/purchase-orders/' + order.id + '/returns')
        .send({
          ...body,
          idempotencyKey: randomUUID(),
          lines: [{ orderItemId: order.items[0].id, quantity: 1 }],
        })
        .expect(422);
      await api('post', '/dealer/purchase-orders/' + order.id + '/refunds')
        .send(refundBody(1000, { returnId: id }))
        .expect(422);
      await (
        await admin('/admin/b2b/returns/' + id + '/decision', {
          decision: 'APPROVE',
          reason: 'Return authorized for inspection',
        })
      ).expect(201);
      await api('post', '/dealer/returns/' + id + '/tracking', outsider)
        .send({ carrier: 'QA', trackingNumber: 'RETURN-1' })
        .expect(404);
      await api('post', '/dealer/returns/' + id + '/tracking')
        .send({ carrier: 'QA', trackingNumber: 'RETURN-1' })
        .expect(201);
      const receipt = {
        receiveKey: randomUUID(),
        note: 'Two received; one damaged item excluded from inventory',
        lines: [
          { orderItemId: order.items[0].id, quantity: 2, restockQuantity: 1 },
        ],
      };
      await (
        await admin('/admin/b2b/returns/' + id + '/receive', {
          ...receipt,
          lines: [{ ...receipt.lines[0], restockQuantity: 3 }],
        })
      ).expect(422);
      await (
        await admin('/admin/b2b/returns/' + id + '/receive', receipt)
      ).expect(201);
      await (
        await admin('/admin/b2b/returns/' + id + '/receive', receipt)
      ).expect(201);
      expect(
        await prisma.stock.findUnique({ where: { variantId: variant.id } }),
      ).toMatchObject({ available: 7, reserved: 2 });
      expect(
        await prisma.marketInventory.findUnique({
          where: { variantId_market: { variantId: variant.id, market: 'US' } },
        }),
      ).toMatchObject({ available: 7, reserved: 2 });
      await api('post', '/dealer/purchase-orders/' + order.id + '/refunds')
        .send(refundBody(2100, { returnId: id }))
        .expect(422);
      const refund = (
        await api('post', '/dealer/purchase-orders/' + order.id + '/refunds')
          .send(refundBody(2000, { returnId: id }))
          .expect(201)
      ).body.data;
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/decision', {
          decision: 'APPROVE',
          reason: 'Received return confirmed',
        })
      ).expect(201);
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/offline-confirm', {
          amountCents: 2000,
          providerReference: 'BANK-RETURN-2',
        })
      ).expect(201);
      expect(
        await prisma.purchaseOrder.findUnique({ where: { id: order.id } }),
      ).toMatchObject({
        paymentStatus: 'PARTIALLY_REFUNDED',
        status: 'PROCESSING',
        totalCents: 4200,
      });
      await (
        await admin(
          '/admin/b2b/purchase-orders/' + order.id + '/offline-payment',
          {
            amountCents: 4200,
            providerReference: 'DUPLICATE-PAY',
            idempotencyKey: randomUUID(),
          },
        )
      ).expect(409);
    });
    it('retries an uncertain provider result with the same refund ID and prevents premature inventory release', async () => {
      const { order, variant } = await fixture(0, 'WEBHOOK');
      const refund = (
        await api('post', '/dealer/purchase-orders/' + order.id + '/refunds')
          .send(refundBody(4200, { cancelOrder: true }))
          .expect(201)
      ).body.data;
      failNext = true;
      const beforeCalls = providerCalls;
      const first = await (
        await admin('/admin/b2b/refunds/' + refund.id + '/decision', {
          decision: 'APPROVE',
          reason: 'Provider refund approved',
        })
      ).expect(201);
      expect(first.body.data).toMatchObject({
        status: 'PENDING',
        lastError: 'PROVIDER_REFUND_UNCONFIRMED',
      });
      expect(external.has(refund.id)).toBe(true);
      expect(
        await prisma.stock.findUnique({ where: { variantId: variant.id } }),
      ).toMatchObject({ available: 6, reserved: 4 });
      await prisma.purchaseOrderRefund.update({
        where: { id: refund.id },
        data: { availableAt: new Date(Date.now() - 1000) },
      });
      const service = app.get(B2bAfterSalesService);
      await Promise.all([
        service.deliverRefund(refund.id),
        service.deliverRefund(refund.id),
      ]);
      expect(providerCalls - beforeCalls).toBe(2);
      expect(
        await prisma.purchaseOrderRefund.findUnique({
          where: { id: refund.id },
        }),
      ).toMatchObject({
        status: 'SUCCEEDED',
        attempts: 2,
        providerReference: external.get(refund.id)!.reference,
      });
      expect(
        await prisma.stock.findUnique({ where: { variantId: variant.id } }),
      ).toMatchObject({ available: 10, reserved: 0 });
    });
    it('automatically refunds a late card capture after cancellation without reserving or releasing stock twice', async () => {
      const { order, variant } = await fixture(0, 'WEBHOOK');
      const payment = order.payments[0];
      await prisma.purchaseOrderPayment.update({
        where: { id: payment.id },
        data: { status: 'PENDING' },
      });
      await prisma.purchaseOrder.update({
        where: { id: order.id },
        data: { paymentStatus: 'UNPAID' },
      });
      await api('patch', '/dealer/purchase-orders/' + order.id + '/cancel')
        .send({ reason: 'Cancelled before payment completed' })
        .expect(200);
      const event = {
        eventId: 'late-' + randomUUID(),
        paymentId: payment.id,
        status: 'SUCCEEDED',
        amountCents: 4200,
        currency: 'USD',
        providerReference: payment.providerReference,
      };
      const timestamp = String(Date.now());
      const { signPayment } = await import('../src/order/commerce-rules.js');
      for (let n = 0; n < 2; n++)
        await request(app.getHttpServer())
          .post('/api/v1/dealer/payments/webhook')
          .set('x-payment-timestamp', timestamp)
          .set(
            'x-payment-signature',
            signPayment(event as never, timestamp, providerSecret),
          )
          .send(event)
          .expect(201);
      expect(
        await prisma.purchaseOrderRefund.count({
          where: { orderId: order.id, status: 'SUCCEEDED' },
        }),
      ).toBe(1);
      expect(
        await prisma.purchaseOrder.findUnique({ where: { id: order.id } }),
      ).toMatchObject({
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        inventoryReserved: false,
      });
      expect(
        await prisma.stock.findUnique({ where: { variantId: variant.id } }),
      ).toMatchObject({ available: 10, reserved: 0 });
    });

    it('keeps mismatched provider amounts pending and leaves completed payment state unchanged on duplicate success callbacks', async () => {
      const { order } = await fixture(0, 'WEBHOOK');
      const refund = (
        await api('post', '/dealer/purchase-orders/' + order.id + '/refunds')
          .send(refundBody(1000))
          .expect(201)
      ).body.data;
      wrongAmount = true;
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/decision', {
          decision: 'APPROVE',
          reason: 'Partial compensation approved',
        })
      ).expect(201);
      wrongAmount = false;
      expect(
        await prisma.purchaseOrderRefund.findUnique({
          where: { id: refund.id },
        }),
      ).toMatchObject({ status: 'PENDING' });
      await (
        await admin('/admin/b2b/refunds/' + refund.id + '/retry', {})
      ).expect(201);
      expect(
        await prisma.purchaseOrder.findUnique({ where: { id: order.id } }),
      ).toMatchObject({ paymentStatus: 'PARTIALLY_REFUNDED' });
      const payment = order.payments[0],
        event = {
          eventId: 'repeat-' + randomUUID(),
          paymentId: payment.id,
          status: 'SUCCEEDED',
          amountCents: 4200,
          currency: 'USD',
          providerReference: payment.providerReference,
        };
      const timestamp = String(Date.now());
      const { signPayment } = await import('../src/order/commerce-rules.js');
      const webhook = await request(app.getHttpServer())
        .post('/api/v1/dealer/payments/webhook')
        .set('x-payment-timestamp', timestamp)
        .set(
          'x-payment-signature',
          signPayment(event as never, timestamp, providerSecret),
        )
        .send(event);
      expect(webhook.status).toBe(201);
      expect(
        await prisma.purchaseOrder.findUnique({ where: { id: order.id } }),
      ).toMatchObject({ paymentStatus: 'PARTIALLY_REFUNDED' });
    });
  },
);

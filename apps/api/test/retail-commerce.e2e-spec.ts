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
import { signPayment } from '../src/order/commerce-rules.js';
import { vi } from 'vitest';
import { searchQuery } from '../src/platform/search-query.js';

describe.skipIf(process.env.E2E_DB !== '1')(
  'Retail commerce: HTTP, DB, stock and provider boundaries',
  () => {
    const prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const market = 'QZ';
    const users: string[] = [];
    const products: string[] = [];
    const couponCode = `RETAIL_${suffix.toUpperCase()}`;
    const secret = generateSecret();
    let app: INestApplication,
      jwt: JwtService,
      staffId = '',
      adminToken = '';
    const previousWebhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const address = {
      recipient: 'Retail Tester',
      phone: '123456789',
      country: market,
      region: 'Test Region',
      city: 'Test City',
      postalCode: '10000',
      line1: '12 Integration Street',
    };
    const api = (
      method: 'get' | 'post' | 'patch',
      path: string,
      token?: string,
    ) => {
      const r = request(app.getHttpServer())[method](`/api/v1${path}`);
      return token ? r.set('Authorization', `Bearer ${token}`) : r;
    };
    const adminHeaders = async () => ({
      Authorization: `Bearer ${adminToken}`,
      'x-mfa-code': await generate({ secret }),
    });
    async function fixture(quantity = 2) {
      const user = await prisma.user.create({
        data: {
          email: `retail-${suffix}-${users.length}@example.test`,
          name: 'Retail tester',
          passwordHash: 'unused',
          ageConfirmed: true,
          status: 'ACTIVE',
        },
      });
      users.push(user.id);
      const product = await prisma.product.create({
        data: {
          name: `Retail ${suffix} ${products.length}`,
          slug: `retail-${suffix}-${products.length}`,
          summary: 'Retail integration product',
          status: 'ACTIVE',
          markets: [market],
          ageMin: 5,
          ageMax: 12,
          scenes: ['Outdoor'],
          skills: ['Balance'],
          tags: ['Featured'],
          specifications: {
            material: 'Wood',
            translations: {
              zh: {
                status: 'PUBLISHED',
                name: '运动玩具',
                summary: '户外平衡运动',
                specifications: { material: { label: '材料', value: '木材' } },
              },
            },
          },
        },
      });
      products.push(product.id);
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `RET-${suffix}-${products.length}`,
          msrpCents: 1000,
          b2bDefaultPriceCents: 123,
          status: true,
          stock: { create: { available: 10 } },
        },
      });
      await prisma.cart.create({
        data: {
          userId: user.id,
          items: {
            create: { variantId: variant.id, quantity, unitPriceCents: 1 },
          },
        },
      });
      return {
        user,
        product,
        variant,
        token: await authenticatedFixture(prisma, jwt, user, 'customer'),
      };
    }
    async function checkout(f: Awaited<ReturnType<typeof fixture>>) {
      const r = await api('post', '/orders/checkout', f.token)
        .send({ market, shippingAddress: address })
        .expect(201);
      return r.body.data;
    }
    async function paid(f: Awaited<ReturnType<typeof fixture>>) {
      const order = await checkout(f);
      const p = await api(
        'post',
        `/orders/${order.id}/payment-session`,
        f.token,
      )
        .send({ idempotencyKey: `payment-${order.id}` })
        .expect(201);
      await api('post', `/orders/payments/${p.body.data.id}/demo`, f.token)
        .send({ status: 'SUCCEEDED' })
        .expect(201);
      return { ...order, payment: p.body.data };
    }
    async function shipped(f: Awaited<ReturnType<typeof fixture>>) {
      const order = await paid(f);
      await api('post', `/admin/commerce/orders/${order.id}/shipments`)
        .set(await adminHeaders())
        .send({
          idempotencyKey: `shipment-${order.id}`,
          carrier: 'Test carrier',
          trackingNumber: `TRACK-${order.id}`,
          items: order.items.map((i: any) => ({
            orderItemId: i.id,
            quantity: i.quantity,
          })),
        })
        .expect(201);
      return order;
    }
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      await setupApp(app);
      await app.init();
      jwt = app.get(JwtService);
      const role = await prisma.role.upsert({
        where: { code: 'SUPER_ADMIN' },
        create: { code: 'SUPER_ADMIN', name: 'Super administrator' },
        update: {},
      });
      const staff = await prisma.staff.create({
        data: {
          email: `retail-admin-${suffix}@example.test`,
          name: 'Retail operator',
          passwordHash: 'unused',
          mfaEnabled: true,
          mfaSecret: secret,
          roles: { create: { roleId: role.id } },
        },
      });
      staffId = staff.id;
      adminToken = await authenticatedFixture(prisma, jwt, staff, 'staff');
      await prisma.retailMarket.upsert({
        where: { code: market },
        create: {
          code: market,
          label: 'Retail isolated test market',
          currency: 'USD',
          retailEnabled: true,
          countries: [market],
          taxBps: 1000,
          shippingCents: 500,
          expressCents: 1000,
          reservationMinutes: 30,
          paymentMode: 'DEMO',
        },
        update: {
          currency: 'USD',
          retailEnabled: true,
          taxBps: 1000,
          shippingCents: 500,
          expressCents: 1000,
          paymentMode: 'DEMO',
        },
      });
      process.env.PAYMENT_WEBHOOK_SECRET = 'retail-integration-webhook-secret';
    });
    afterAll(async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = previousWebhookSecret;
      await app?.close();
      const orders = await prisma.order.findMany({
        where: { userId: { in: users } },
        select: { id: true },
      });
      const ids = orders.map((o) => o.id);
      const payments = await prisma.retailPayment.findMany({
        where: { orderId: { in: ids } },
        select: { id: true },
      });
      await prisma.retailPaymentEvent.deleteMany({
        where: { paymentId: { in: payments.map((p) => p.id) } },
      });
      await prisma.retailRefund.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.retailReturn.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.retailShipment.deleteMany({
        where: { orderId: { in: ids } },
      });
      await prisma.retailPayment.deleteMany({
        where: { orderId: { in: ids } },
      });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [...users, staffId] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.retailPriceHistory.deleteMany({
        where: {
          variantId: {
            in: (
              await prisma.productVariant.findMany({
                where: { productId: { in: products } },
                select: { id: true },
              })
            ).map((v) => v.id),
          },
        },
      });
      await prisma.product.deleteMany({ where: { id: { in: products } } });
      if (staffId) await prisma.staff.delete({ where: { id: staffId } });
      await prisma.retailCoupon.deleteMany({ where: { code: couponCode } });
      await prisma.retailMarket.deleteMany({ where: { code: market } });
      await prisma.$disconnect();
    });
    it('takes fresh server prices and snapshots addresses, discounts, shipping, tax and currency', async () => {
      const f = await fixture();
      await prisma.retailCoupon.create({
        data: {
          code: couponCode,
          market,
          percentBps: 1000,
          productIds: [f.product.id],
          userIds: [f.user.id],
          perUserLimit: 1,
          maxUses: 1,
        },
      });
      await prisma.productVariant.update({
        where: { id: f.variant.id },
        data: { msrpCents: 1200 },
      });
      const r = await api('post', '/orders/checkout', f.token)
        .send({
          market,
          couponCode,
          shippingAddress: address,
          billingAddress: { ...address, line1: 'Billing address' },
        })
        .expect(201);
      expect(r.body.data).toMatchObject({
        subtotalCents: 2400,
        discountCents: 240,
        shippingCents: 500,
        taxCents: 266,
        totalCents: 2926,
        currency: 'USD',
        shippingAddress: address,
        billingAddress: { line1: 'Billing address' },
      });
      expect(r.body.data.items[0]).toMatchObject({
        unitPriceCents: 1200,
        lineCents: 2400,
      });
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 8, reserved: 2 });
    });
    it('requires an address and enforces retail closed mode in checkout and public prices', async () => {
      const f = await fixture();
      await api('post', '/orders/checkout', f.token)
        .send({ market })
        .expect(400);
      await prisma.retailMarket.update({
        where: { code: market },
        data: { retailEnabled: false },
      });
      await api('post', '/orders/checkout', f.token)
        .send({ market, shippingAddress: address })
        .expect(409);
      const p = await api(
        'get',
        `/products/${f.product.slug}?market=${market}`,
      ).expect(200);
      expect(p.body.data.retailEnabled).toBe(false);
      expect(p.body.data.variants[0].price).toBeNull();
      await prisma.retailMarket.update({
        where: { code: market },
        data: { retailEnabled: true },
      });
    });
    it('merges guest cart quantities once across retries and rejects duplicate variants', async () => {
      const f = await fixture();
      const body = {
        idempotencyKey: `guest-${f.user.id}`,
        market,
        items: [{ variantId: f.variant.id, quantity: 1 }],
      };
      await api('post', '/cart/merge', f.token).send(body).expect(201);
      const replay = await api('post', '/cart/merge', f.token)
        .send(body)
        .expect(201);
      expect(replay.body.data.items[0].quantity).toBe(3);
      await api('post', '/cart/merge', f.token)
        .send({
          ...body,
          idempotencyKey: `bad-${f.user.id}`,
          items: [...body.items, ...body.items],
        })
        .expect(422);
    });
    it('makes payment sessions and signed events idempotent and binds amount, currency and terminal state', async () => {
      const f = await fixture();
      const order = await checkout(f);
      const body = { idempotencyKey: `signed-${order.id}` };
      const p = await api(
        'post',
        `/orders/${order.id}/payment-session`,
        f.token,
      )
        .send(body)
        .expect(201);
      const replay = await api(
        'post',
        `/orders/${order.id}/payment-session`,
        f.token,
      )
        .send(body)
        .expect(201);
      expect(replay.body.data.id).toBe(p.body.data.id);
      await prisma.retailPayment.update({
        where: { id: p.body.data.id },
        data: { mode: 'WEBHOOK' },
      });
      const event = {
        eventId: `evt-${order.id}`,
        paymentId: p.body.data.id,
        status: 'SUCCEEDED',
        amountCents: order.totalCents,
        currency: 'USD',
        providerReference: 'PSP-transaction-001',
      };
      const timestamp = String(Date.now());
      const signature = signPayment(
        event,
        timestamp,
        process.env.PAYMENT_WEBHOOK_SECRET!,
      );
      await api('post', '/commerce/payment-webhook')
        .set('x-payment-timestamp', timestamp)
        .set('x-payment-signature', signature)
        .send({ ...event, amountCents: 1 })
        .expect(409);
      await api('post', '/commerce/payment-webhook')
        .set('x-payment-timestamp', timestamp)
        .set('x-payment-signature', signature)
        .send(event)
        .expect(201);
      const duplicate = await api('post', '/commerce/payment-webhook')
        .set('x-payment-timestamp', timestamp)
        .set('x-payment-signature', signature)
        .send(event)
        .expect(201);
      expect(duplicate.body.data.duplicate).toBe(true);
      expect(
        await prisma.order.findUnique({ where: { id: order.id } }),
      ).toMatchObject({ paymentStatus: 'PAID', status: 'CONFIRMED' });
    });
    it('records demo payment failures and lets the customer retry without duplicate capture', async () => {
      const f = await fixture();
      const order = await checkout(f);
      const p = await api(
        'post',
        `/orders/${order.id}/payment-session`,
        f.token,
      )
        .send({ idempotencyKey: `failed-${order.id}` })
        .expect(201);
      await api('post', `/orders/payments/${p.body.data.id}/demo`, f.token)
        .send({ status: 'FAILED' })
        .expect(201);
      const retry = await api(
        'post',
        `/orders/${order.id}/payment-session`,
        f.token,
      )
        .send({ idempotencyKey: `retry-${order.id}` })
        .expect(201);
      expect(retry.body.data.id).not.toBe(p.body.data.id);
      await api('post', `/orders/payments/${retry.body.data.id}/demo`, f.token)
        .send({ status: 'SUCCEEDED' })
        .expect(201);
      await api('post', `/orders/payments/${p.body.data.id}/demo`, f.token)
        .send({ status: 'SUCCEEDED' })
        .expect(409);
    });
    it('ships line quantities in batches and never decrements a reservation twice', async () => {
      const f = await fixture();
      const order = await paid(f);
      const first = {
        idempotencyKey: `partial-${order.id}`,
        carrier: 'Test carrier',
        trackingNumber: 'PART-1',
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      };
      await api('post', `/admin/commerce/orders/${order.id}/shipments`)
        .set(await adminHeaders())
        .send(first)
        .expect(201);
      await api('post', `/admin/commerce/orders/${order.id}/shipments`)
        .set(await adminHeaders())
        .send(first)
        .expect(201);
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 8, reserved: 1 });
      await api('post', `/admin/commerce/orders/${order.id}/shipments`)
        .set(await adminHeaders())
        .send({
          ...first,
          idempotencyKey: `overship-${order.id}`,
          items: [{ orderItemId: order.items[0].id, quantity: 2 }],
        })
        .expect(409);
      await api('post', `/admin/commerce/orders/${order.id}/shipments`)
        .set(await adminHeaders())
        .send({
          ...first,
          idempotencyKey: `final-${order.id}`,
          trackingNumber: 'PART-2',
        })
        .expect(201);
      expect(
        await prisma.order.findUnique({ where: { id: order.id } }),
      ).toMatchObject({ status: 'FULFILLED' });
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ reserved: 0 });
    });
    it('protects order details, documents and returns against another customer', async () => {
      const a = await fixture(),
        b = await fixture();
      const order = await checkout(a);
      await api('get', `/orders/${order.id}`, b.token).expect(404);
      await api('get', `/orders/${order.id}/documents/invoice`, b.token).expect(
        404,
      );
      await api('post', `/orders/${order.id}/returns`, b.token)
        .send({
          reason: 'Wrong owner',
          items: [{ orderItemId: order.items[0].id, quantity: 1 }],
        })
        .expect(404);
    });
    it('enforces the return state machine, returns received stock once, and bounds refunds to captured funds', async () => {
      const f = await fixture();
      const order = await shipped(f);
      const r = await api('post', `/orders/${order.id}/returns`, f.token)
        .send({
          reason: 'One item damaged',
          items: [{ orderItemId: order.items[0].id, quantity: 1 }],
        })
        .expect(201);
      const returnId = r.body.data.id;
      await api('patch', `/admin/commerce/returns/${returnId}`)
        .set(await adminHeaders())
        .send({ status: 'RECEIVED', staffNote: 'Out of order' })
        .expect(409);
      await api('patch', `/admin/commerce/returns/${returnId}`)
        .set(await adminHeaders())
        .send({ status: 'APPROVED', staffNote: 'Return approved' })
        .expect(200);
      await api('patch', `/admin/commerce/returns/${returnId}`)
        .set(await adminHeaders())
        .send({ status: 'RECEIVED', staffNote: 'One unit received' })
        .expect(200);
      await api('patch', `/admin/commerce/returns/${returnId}`)
        .set(await adminHeaders())
        .send({ status: 'RECEIVED', staffNote: 'Duplicate receipt' })
        .expect(409);
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 9, reserved: 0 });
      await api('post', `/admin/commerce/orders/${order.id}/refunds`)
        .set(await adminHeaders())
        .send({
          idempotencyKey: `refund-over-${order.id}`,
          amountCents: order.totalCents + 1,
          reason: 'Invalid excess',
        })
        .expect(409);
      const refund = {
        idempotencyKey: `refund-${order.id}`,
        returnId,
        amountCents: 1000,
        reason: 'One item refund',
      };
      const ref = await api(
        'post',
        `/admin/commerce/orders/${order.id}/refunds`,
      )
        .set(await adminHeaders())
        .send(refund)
        .expect(201);
      expect(ref.body.data.status).toBe('SUCCEEDED');
      await api('post', `/admin/commerce/orders/${order.id}/refunds`)
        .set(await adminHeaders())
        .send(refund)
        .expect(201);
      expect(
        await prisma.retailRefund.count({ where: { orderId: order.id } }),
      ).toBe(1);
      await api('patch', `/admin/commerce/returns/${returnId}`)
        .set(await adminHeaders())
        .send({ status: 'COMPLETED', staffNote: 'Refund completed' })
        .expect(200);
      const receipt = await api(
        'get',
        `/orders/${order.id}/documents/receipt`,
        f.token,
      ).expect(200);
      expect(receipt.body.data.order.paymentStatus).toBe('PARTIALLY_REFUNDED');
    });
    it('completes an exchange through a replacement shipment with transactional available stock', async () => {
      const f = await fixture();
      const order = await shipped(f);
      const lines = [{ orderItemId: order.items[0].id, quantity: 1 }];
      const r = await api('post', `/orders/${order.id}/returns`, f.token)
        .send({
          resolution: 'EXCHANGE',
          reason: 'Exchange one item',
          items: lines,
        })
        .expect(201);
      for (const status of ['APPROVED', 'RECEIVED'])
        await api('patch', `/admin/commerce/returns/${r.body.data.id}`)
          .set(await adminHeaders())
          .send({ status, staffNote: 'Exchange inspected' })
          .expect(200);
      await api(
        'post',
        `/admin/commerce/returns/${r.body.data.id}/exchange-shipment`,
      )
        .set(await adminHeaders())
        .send({
          idempotencyKey: `exchange-${order.id}`,
          carrier: 'Test carrier',
          trackingNumber: 'REPLACEMENT',
          items: lines,
        })
        .expect(201);
      expect(
        await prisma.retailReturn.findUnique({ where: { id: r.body.data.id } }),
      ).toMatchObject({ status: 'COMPLETED' });
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 8, reserved: 0 });
    });
    it('expires abandoned orders once and rejects payment after inventory release', async () => {
      const f = await fixture();
      const order = await checkout(f);
      const p = await api(
        'post',
        `/orders/${order.id}/payment-session`,
        f.token,
      )
        .send({ idempotencyKey: `expired-${order.id}` })
        .expect(201);
      await prisma.order.update({
        where: { id: order.id },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });
      await Promise.all([
        api('post', '/admin/commerce/expire-reservations')
          .set(await adminHeaders())
          .send({}),
        api('post', '/admin/commerce/expire-reservations')
          .set(await adminHeaders())
          .send({}),
      ]);
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 10, reserved: 0 });
      await api('post', `/orders/payments/${p.body.data.id}/demo`, f.token)
        .send({ status: 'SUCCEEDED' })
        .expect(409);
    });
    it('requires configured currency prices and supports structured filters, scheduled visibility and locale fallback', async () => {
      const f = await fixture();
      await prisma.retailMarket.update({
        where: { code: market },
        data: { currency: 'CNY' },
      });
      await api('post', '/orders/quote', f.token)
        .send({ market, shippingAddress: address })
        .expect(409);
      await prisma.productVariant.update({
        where: { id: f.variant.id },
        data: {
          marketPrices: { [market]: { currency: 'CNY', msrpCents: 800 } },
        },
      });
      const quote = await api('post', '/orders/quote', f.token)
        .send({ market, shippingAddress: address })
        .expect(201);
      expect(quote.body.data).toMatchObject({
        currency: 'CNY',
        subtotalCents: 1600,
      });
      const list = await api(
        'get',
        `/products?market=${market}&search=${encodeURIComponent(f.product.name)}&scene=Outdoor&skill=Balance&age=8&stock=in&sort=price-asc`,
      ).expect(200);
      expect(list.body.data.items[0]).toMatchObject({
        id: f.product.id,
        priceCents: 800,
        currency: 'CNY',
      });
      const localized = await api(
        'get',
        `/products/${f.product.slug}?market=${market}&locale=zh`,
      ).expect(200);
      expect(localized.body.data.name).toBe('运动玩具');
      expect(JSON.stringify(localized.body.data)).not.toContain(
        'b2bDefaultPriceCents',
      );
      await prisma.product.update({
        where: { id: f.product.id },
        data: { status: 'SCHEDULED', publishAt: new Date(Date.now() + 60000) },
      });
      await api('get', `/products/${f.product.slug}?market=${market}`).expect(
        404,
      );
      await prisma.product.update({
        where: { id: f.product.id },
        data: { publishAt: new Date(Date.now() - 60000) },
      });
      await api('get', `/products/${f.product.slug}?market=${market}`).expect(
        200,
      );
      await prisma.product.update({
        where: { id: f.product.id },
        data: { status: 'HIDDEN' },
      });
      await api('get', `/products/${f.product.slug}?market=${market}`).expect(
        404,
      );
      await prisma.retailMarket.update({
        where: { code: market },
        data: { currency: 'USD' },
      });
    });
    it('previews catalog changes before an atomic audited import and duplicates drafts without inventory', async () => {
      const f = await fixture();
      const row = {
        slug: f.product.slug,
        name: f.product.name,
        sku: f.variant.sku,
        msrpCents: 1750,
        available: 7,
        status: 'ACTIVE',
      };
      const preview = await api('post', '/admin/catalog/import')
        .set(await adminHeaders())
        .send({ rows: [row], apply: false })
        .expect(201);
      expect(preview.body.data).toMatchObject({
        updates: 1,
        applied: false,
        errors: [],
      });
      expect(
        (
          await prisma.productVariant.findUniqueOrThrow({
            where: { id: f.variant.id },
          })
        ).msrpCents,
      ).toBe(1000);
      await api('post', '/admin/catalog/import')
        .set(await adminHeaders())
        .send({ rows: [row], apply: true })
        .expect(201);
      expect(
        (
          await prisma.productVariant.findUniqueOrThrow({
            where: { id: f.variant.id },
          })
        ).msrpCents,
      ).toBe(1750);
      expect(
        await prisma.retailPriceHistory.count({
          where: { variantId: f.variant.id },
        }),
      ).toBe(1);
      const copy = await api(
        'post',
        `/admin/catalog/products/${f.product.id}/copy`,
      )
        .set(await adminHeaders())
        .send({ slug: `${f.product.slug}-copy`, skuPrefix: `COPY-${suffix}` })
        .expect(201);
      products.push(copy.body.data.id);
      expect(copy.body.data.status).toBe('DRAFT');
      const variants = await prisma.productVariant.findMany({
        where: { productId: copy.body.data.id },
        include: { stock: true },
      });
      expect(variants[0].stock?.available).toBe(0);
    });
    it('creates assisted orders without changing the customer cart', async () => {
      const f = await fixture();
      const result = await api('post', '/admin/commerce/orders')
        .set(await adminHeaders())
        .send({
          userId: f.user.id,
          reason: 'Customer phone order',
          market,
          shippingAddress: address,
          items: [{ variantId: f.variant.id, quantity: 1 }],
        })
        .expect(201);
      expect(result.body.data.items[0].quantity).toBe(1);
      expect(
        (
          await prisma.cartItem.findFirstOrThrow({
            where: { cart: { userId: f.user.id } },
          })
        ).quantity,
      ).toBe(2);
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 9, reserved: 1 });
    });
    it('compensates a late authenticated provider capture through a durable idempotent refund', async () => {
      const f = await fixture();
      const order = await checkout(f);
      const session = await api(
        'post',
        `/orders/${order.id}/payment-session`,
        f.token,
      )
        .send({ idempotencyKey: `late-${order.id}` })
        .expect(201);
      await prisma.retailPayment.update({
        where: { id: session.body.data.id },
        data: { mode: 'WEBHOOK' },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });
      const oldUrl = process.env.PAYMENT_PROVIDER_URL,
        oldKey = process.env.PAYMENT_PROVIDER_KEY;
      process.env.PAYMENT_PROVIDER_URL = 'https://provider.example.test';
      process.env.PAYMENT_PROVIDER_KEY = 'provider-test-key';
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'SUCCEEDED',
            reference: 'REFUND-LATE-001',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      try {
        const event = {
          eventId: `late-event-${order.id}`,
          paymentId: session.body.data.id,
          status: 'SUCCEEDED',
          amountCents: order.totalCents,
          currency: 'USD',
          providerReference: 'LATE-CAPTURE-001',
        };
        const timestamp = String(Date.now()),
          signature = signPayment(
            event,
            timestamp,
            process.env.PAYMENT_WEBHOOK_SECRET!,
          );
        await api('post', '/commerce/payment-webhook')
          .set('x-payment-timestamp', timestamp)
          .set('x-payment-signature', signature)
          .send(event)
          .expect(201);
        expect(
          await prisma.order.findUnique({ where: { id: order.id } }),
        ).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' });
        expect(
          await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
        ).toMatchObject({ available: 10, reserved: 0 });
        expect(
          await prisma.retailRefund.count({ where: { orderId: order.id } }),
        ).toBe(1);
        expect(fetchMock).toHaveBeenCalledOnce();
        const init = fetchMock.mock.calls[0][1]!;
        expect(new Headers(init.headers).get('x-payment-signature')).toMatch(
          /^[a-f0-9]{64}$/,
        );
        await api('post', '/commerce/payment-webhook')
          .set('x-payment-timestamp', timestamp)
          .set('x-payment-signature', signature)
          .send(event)
          .expect(201);
        expect(fetchMock).toHaveBeenCalledOnce();
      } finally {
        fetchMock.mockRestore();
        if (oldUrl === undefined) delete process.env.PAYMENT_PROVIDER_URL;
        else process.env.PAYMENT_PROVIDER_URL = oldUrl;
        if (oldKey === undefined) delete process.env.PAYMENT_PROVIDER_KEY;
        else process.env.PAYMENT_PROVIDER_KEY = oldKey;
      }
    });
    it('keeps source-failure quantities intact, blocks checkout and recovers on a healthy stock update', async () => {
      const f = await fixture();
      await api('patch', `/admin/catalog/variants/${f.variant.id}`)
        .set(await adminHeaders())
        .send({ syncError: 'WAREHOUSE_UNAVAILABLE', available: 0 })
        .expect(422);
      await api('patch', `/admin/catalog/variants/${f.variant.id}`)
        .set(await adminHeaders())
        .send({
          syncError: 'WAREHOUSE_UNAVAILABLE',
          inventorySource: 'Warehouse import',
          lowThreshold: 12,
        })
        .expect(200);
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({
        available: 10,
        reserved: 0,
        syncError: 'WAREHOUSE_UNAVAILABLE',
      });
      const product = await api(
        'get',
        `/products/${f.product.slug}?market=${market}`,
      ).expect(200);
      expect(product.body.data.variants[0].availability).toBe(
        'CHECK_AVAILABILITY',
      );
      const cards = await api(
        'get',
        `/products?market=${market}&ids=${f.product.id}&stock=in`,
      ).expect(200);
      expect(cards.body.data.total).toBe(0);
      await api('post', '/orders/checkout', f.token)
        .send({ market, shippingAddress: address })
        .expect(409);
      const alerts = await api('get', '/admin/commerce/inventory-alerts')
        .set(await adminHeaders())
        .expect(200);
      expect(
        alerts.body.data.some((r: any) => r.variantId === f.variant.id),
      ).toBe(true);
      await api('patch', `/admin/catalog/variants/${f.variant.id}`)
        .set(await adminHeaders())
        .send({ available: 7 })
        .expect(200);
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 7, syncError: null });
      await checkout(f);
      expect(
        await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
      ).toMatchObject({ available: 5, reserved: 2 });
    });
    it('restricts curated product ids to public market-visible products and validates the 24-id limit', async () => {
      const visible = await fixture(),
        hidden = await fixture();
      await prisma.product.update({
        where: { id: hidden.product.id },
        data: { status: 'HIDDEN' },
      });
      const selected = await api(
        'get',
        `/products?market=${market}&ids=${visible.product.id},${hidden.product.id},${visible.product.id}`,
      ).expect(200);
      expect(selected.body.data.items.map((p: any) => p.id)).toEqual([
        visible.product.id,
      ]);
      await api(
        'get',
        `/products?market=${market}&ids=${Array(25).fill(visible.product.id).join(',')}`,
      ).expect(400);
      const wrongMarket = await api(
        'get',
        `/products?market=US&ids=${visible.product.id}`,
      ).expect(200);
      expect(wrongMarket.body.data.total).toBe(0);
    });
    it('serializes market allocations, never over-reserves the global pool and restores the same market on cancellation', async () => {
      const first = await fixture(1),
        second = await fixture(1);
      await prisma.cartItem.updateMany({
        where: { cart: { userId: second.user.id } },
        data: { variantId: first.variant.id },
      });
      await api('post', `/admin/commerce/inventory/${first.variant.id}`)
        .set(await adminHeaders())
        .send({ market, available: 1, source: 'Test market allocation' })
        .expect(201);
      const outcomes = await Promise.all(
        [first, second].map((f) =>
          api('post', '/orders/checkout', f.token).send({
            market,
            shippingAddress: address,
          }),
        ),
      );
      expect(outcomes.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        await prisma.stock.findUnique({
          where: { variantId: first.variant.id },
        }),
      ).toMatchObject({ available: 9, reserved: 1 });
      expect(
        await prisma.marketInventory.findUnique({
          where: { variantId_market: { variantId: first.variant.id, market } },
        }),
      ).toMatchObject({ available: 0, reserved: 1 });
      const winner = outcomes.findIndex((r) => r.status === 201);
      await api(
        'patch',
        `/orders/${outcomes[winner].body.data.id}/cancel`,
        [first, second][winner].token,
      )
        .send({})
        .expect(200);
      expect(
        await prisma.marketInventory.findUnique({
          where: { variantId_market: { variantId: first.variant.id, market } },
        }),
      ).toMatchObject({ available: 1, reserved: 0 });
    });
    it('allows bounded backorders only under matching market policy and requires replenishment before shipment', async () => {
      const f = await fixture(2);
      await prisma.stock.update({
        where: { variantId: f.variant.id },
        data: { available: 0 },
      });
      await api('patch', `/admin/catalog/variants/${f.variant.id}`)
        .set(await adminHeaders())
        .send({
          availabilityPolicy: 'BACKORDER',
          backorderLimit: 2,
          leadTimeDays: 7,
        })
        .expect(200);
      await api('post', '/orders/checkout', f.token)
        .send({ market, shippingAddress: address })
        .expect(409);
      await prisma.retailMarket.update({
        where: { code: market },
        data: { allowBackorder: true, inventoryDisplay: 'EXACT' },
      });
      try {
        await api('patch', `/cart/items/${f.variant.id}`, f.token)
          .send({ quantity: 1, market })
          .expect(200);
        await api('patch', `/cart/items/${f.variant.id}`, f.token)
          .send({ quantity: 3, market })
          .expect(409);
        await api('patch', `/cart/items/${f.variant.id}`, f.token)
          .send({ quantity: 2, market })
          .expect(200);
        const detail = await api(
          'get',
          `/products/${f.product.slug}?market=${market}`,
        ).expect(200);
        expect(detail.body.data.variants[0]).toMatchObject({
          availability: 'BACKORDER',
          purchasable: true,
          availableQuantity: 0,
          leadTimeDays: 7,
        });
        const order = await paid(f);
        expect(
          await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
        ).toMatchObject({ available: -2, reserved: 2 });
        const payload = {
          idempotencyKey: `backorder-${order.id}`,
          carrier: 'Test carrier',
          trackingNumber: 'RESTOCK-1',
          items: order.items.map((i: any) => ({
            orderItemId: i.id,
            quantity: i.quantity,
          })),
        };
        await api('post', `/admin/commerce/orders/${order.id}/shipments`)
          .set(await adminHeaders())
          .send(payload)
          .expect(409);
        await api('patch', `/admin/catalog/variants/${f.variant.id}`)
          .set(await adminHeaders())
          .send({ available: 0 })
          .expect(200);
        await api('post', `/admin/commerce/orders/${order.id}/shipments`)
          .set(await adminHeaders())
          .send(payload)
          .expect(201);
        expect(
          await prisma.stock.findUnique({ where: { variantId: f.variant.id } }),
        ).toMatchObject({ available: 0, reserved: 0 });
      } finally {
        await prisma.retailMarket.update({
          where: { code: market },
          data: { allowBackorder: false, inventoryDisplay: 'STATUS' },
        });
      }
    });
    it('applies weight and region quotes and persists immutable price/tax/shipping sources', async () => {
      const f = await fixture();
      await prisma.productVariant.update({
        where: { id: f.variant.id },
        data: { weightGrams: 600 },
      });
      await prisma.retailMarket.update({
        where: { code: market },
        data: {
          shippingRules: [
            { method: 'STANDARD', minWeightGrams: 1000, amountCents: 700 },
          ],
          taxRegionRates: { 'TEST REGION': 750 },
        },
      });
      try {
        const order = await checkout(f);
        expect(order).toMatchObject({
          shippingCents: 700,
          taxCents: 203,
          totalCents: 2903,
          calculationSnapshot: {
            shipping: { source: 'WEIGHT_AMOUNT_RULE' },
            tax: { rateBps: 750 },
            weightGrams: 1200,
          },
        });
        expect(order.items[0]).toMatchObject({
          priceSource: 'MSRP',
          weightGrams: 600,
        });
        await prisma.retailMarket.update({
          where: { code: market },
          data: { shippingCents: 9900 },
        });
        expect(
          (await api('get', `/orders/${order.id}`, f.token)).body.data
            .totalCents,
        ).toBe(2903);
      } finally {
        await prisma.retailMarket.update({
          where: { code: market },
          data: { shippingRules: [], taxRegionRates: {}, shippingCents: 500 },
        });
      }
    });
    it('enforces unique nonempty barcodes and allows clearing an optional barcode', async () => {
      const first = await fixture(),
        second = await fixture(),
        barcode = `BARCODE-${suffix}`;
      await api('patch', `/admin/catalog/variants/${first.variant.id}`)
        .set(await adminHeaders())
        .send({ barcode })
        .expect(200);
      const duplicate = await api(
        'patch',
        `/admin/catalog/variants/${second.variant.id}`,
      )
        .set(await adminHeaders())
        .send({ barcode })
        .expect(409);
      expect(duplicate.body.message).toContain('barcode');
      await api('patch', `/admin/catalog/variants/${first.variant.id}`)
        .set(await adminHeaders())
        .send({ barcode: '' })
        .expect(200);
      await api('patch', `/admin/catalog/variants/${second.variant.id}`)
        .set(await adminHeaders())
        .send({ barcode })
        .expect(200);
    });
    it('rejects staff sessions on customer order and document routes while authorized admin routes work', async () => {
      const f = await fixture(),
        order = await paid(f);
      await api('get', `/orders/${order.id}`, adminToken).expect(403);
      await api(
        'get',
        `/orders/${order.id}/documents/invoice`,
        adminToken,
      ).expect(403);
      await api(
        'get',
        `/orders/${order.id}/documents/invoice/pdf`,
        adminToken,
      ).expect(403);
      await api('get', `/admin/commerce/orders/${order.id}`, adminToken).expect(
        200,
      );
      await api('get', `/orders/${order.id}/documents/invoice/pdf`, f.token)
        .expect(200)
        .expect('Content-Type', /application\/pdf/);
    });
    it('never publishes draft or incomplete translations through detail, list or nested specifications', async () => {
      const f = await fixture();
      await prisma.product.update({
        where: { id: f.product.id },
        data: {
          specifications: {
            material: 'Wood',
            translations: {
              zh: {
                status: 'DRAFT',
                name: 'PRIVATE DRAFT PRODUCT',
                summary: 'DRAFT SUMMARY',
              },
            },
          },
        },
      });
      const english = await api(
        'get',
        `/products/${f.product.slug}?market=${market}`,
      ).expect(200);
      expect(english.body.data).toMatchObject({
        locale: 'en',
        publishedLanguages: ['en'],
      });
      expect(JSON.stringify(english.body)).not.toContain('PRIVATE DRAFT');
      expect(english.body.data.specifications).not.toHaveProperty(
        'translations',
      );
      const fallback = await api(
        'get',
        `/products/${f.product.slug}?market=${market}&locale=zh`,
      );
      expect([200, 404]).toContain(fallback.status);
      if (fallback.status === 200) expect(fallback.body.data.locale).toBe('en');
      await api('patch', `/admin/catalog/products/${f.product.id}`)
        .set(await adminHeaders())
        .send({
          description: 'Source description',
          specifications: {
            translations: {
              zh: { status: 'PUBLISHED', name: '中文', summary: '摘要' },
            },
          },
        })
        .expect(422);
    });
    it('publishes complete specifications and FAQ consistently in detail, SQL search and sitemap and selects media by locale and market', async () => {
      const f = await fixture();
      const translation = {
        status: 'PUBLISHED',
        name: '完整商品译文',
        summary: '完整中文介绍',
        specifications: { material: { label: '材料', value: '木材' } },
        productFaq: [{ question: '如何清洁？', answer: '用湿布擦拭。' }],
      };
      const faq = [
        { question: 'How to clean?', answer: 'Wipe with a damp cloth.' },
      ];
      const gallery = [
        { url: '/general.jpg', alt: 'General' },
        { url: '/zh.jpg', alt: '中文通用', locale: 'zh' },
        { url: '/zh-market.jpg', alt: '中文市场图片', locale: 'zh', market },
        {
          url: '/zh-market-2.jpg',
          alt: '中文市场图片二',
          locale: 'zh',
          market,
        },
      ];
      const data = {
        productFaq: faq,
        specifications: { material: 'Wood', translations: { zh: translation } },
        gallery,
      };
      await api('patch', `/admin/catalog/products/${f.product.id}`)
        .set(await adminHeaders())
        .send(data)
        .expect(200);
      const page = await api(
        'get',
        `/products/${f.product.slug}?market=${market}&locale=zh`,
      ).expect(200);
      expect(page.body.data).toMatchObject({
        locale: 'zh',
        publishedLanguages: ['en', 'zh'],
        specifications: { 材料: '木材' },
        productFaq: translation.productFaq,
        gallery: [
          { url: '/zh-market.jpg', alt: '中文市场图片' },
          { url: '/zh-market-2.jpg', alt: '中文市场图片二' },
        ],
      });
      expect(JSON.stringify(page.body.data.specifications)).not.toContain(
        'translations',
      );
      const [search] = await prisma.$queryRaw<any[]>(
        searchQuery(
          [f.variant.sku.toLowerCase()],
          'zh',
          market,
          'PRODUCT',
          1,
          true,
        ),
      );
      expect(
        search.items.find((item: any) => item.id === f.product.id),
      ).toMatchObject({ locale: 'zh', title: translation.name });
      const sitemap = await api(
        'get',
        `/site/sitemaps?market=${market}&locale=zh`,
      ).expect(200);
      expect(
        sitemap.body.data.items.some(
          (item: any) => item.path === `/products/${f.product.slug}`,
        ),
      ).toBe(true);
      await api('patch', `/admin/catalog/products/${f.product.id}`)
        .set(await adminHeaders())
        .send({
          gallery: [{ url: '/bad.jpg', alt: 'Bad', locale: 'invalid!' }],
        })
        .expect(422);
      for (const incomplete of [
        { ...translation, productFaq: [] },
        {
          ...translation,
          specifications: { material: { label: '材料', value: '' } },
        },
        { ...translation, name: 123 },
      ]) {
        const specifications = {
          material: 'Wood',
          translations: { zh: incomplete },
        };
        await api('patch', `/admin/catalog/products/${f.product.id}`)
          .set(await adminHeaders())
          .send({ specifications })
          .expect(422);
        // Legacy/raw imports also fail closed without relying on the admin DTO.
        await prisma.product.update({
          where: { id: f.product.id },
          data: { specifications },
        });
        const [hidden] = await prisma.$queryRaw<any[]>(
          searchQuery(
            [f.variant.sku.toLowerCase()],
            'zh',
            market,
            'PRODUCT',
            1,
            true,
          ),
        );
        expect(hidden.items.some((item: any) => item.id === f.product.id)).toBe(
          false,
        );
        const [fallback] = await prisma.$queryRaw<any[]>(
          searchQuery(
            [f.variant.sku.toLowerCase()],
            'zh',
            market,
            'PRODUCT',
            1,
            false,
          ),
        );
        expect(
          fallback.items.find((item: any) => item.id === f.product.id).locale,
        ).toBe('en');
        const map = await api(
          'get',
          `/site/sitemaps?market=${market}&locale=zh`,
        ).expect(200);
        expect(
          map.body.data.items.some(
            (item: any) => item.path === `/products/${f.product.slug}`,
          ),
        ).toBe(false);
      }
    });
    it('supports configured French and regional language translations consistently across product, SQL search and sitemap', async () => {
      const f = await fixture();
      const previous = await prisma.siteSetting.findUnique({
        where: { key: 'locale' },
      });
      const base = (previous?.value ?? {}) as Record<string, any>;
      await prisma.siteSetting.upsert({
        where: { key: 'locale' },
        create: {
          key: 'locale',
          value: {
            ...base,
            languages: [
              ...new Set([...(base.languages ?? ['en', 'zh']), 'fr', 'zh-CN']),
            ],
          },
        },
        update: {
          value: {
            ...base,
            languages: [
              ...new Set([...(base.languages ?? ['en', 'zh']), 'fr', 'zh-CN']),
            ],
          },
        },
      });
      try {
        const fr = {
          status: 'PUBLISHED',
          name: 'Jouet de sport',
          summary: 'Jouer en plein air',
          specifications: { material: { label: 'Matériau', value: 'Bois' } },
        };
        await api('patch', `/admin/catalog/products/${f.product.id}`)
          .set(await adminHeaders())
          .send({
            specifications: {
              material: 'Wood',
              translations: {
                fr,
                'zh-CN': {
                  ...fr,
                  name: '区域译文',
                  summary: '简体中文区域内容',
                },
              },
            },
          })
          .expect(200);
        const detail = await api(
          'get',
          `/products/${f.product.slug}?market=${market}&locale=fr`,
        ).expect(200);
        expect(detail.body.data).toMatchObject({
          locale: 'fr',
          publishedLanguages: ['en', 'fr', 'zh-CN'],
          name: fr.name,
          specifications: { Matériau: 'Bois' },
        });
        const list = await api(
          'get',
          `/products?market=${market}&locale=fr&ids=${f.product.id}`,
        ).expect(200);
        expect(list.body.data.items[0]).toMatchObject({
          locale: 'fr',
          name: fr.name,
        });
        const [result] = await prisma.$queryRaw<any[]>(
          searchQuery(
            [f.variant.sku.toLowerCase()],
            'fr',
            market,
            'PRODUCT',
            1,
            true,
          ),
        );
        expect(
          result.items.find((item: any) => item.id === f.product.id),
        ).toMatchObject({ locale: 'fr', title: fr.name });
        const map = await api(
          'get',
          `/site/sitemaps?market=${market}&locale=fr`,
        ).expect(200);
        expect(
          map.body.data.items.some(
            (item: any) => item.path === `/products/${f.product.slug}`,
          ),
        ).toBe(true);
        const regional = await api(
          'get',
          `/products/${f.product.slug}?market=${market}&locale=zh-CN`,
        ).expect(200);
        expect(regional.body.data.locale).toBe('zh-CN');
        await api(
          'get',
          `/products/${f.product.slug}?market=${market}&locale=invalid!`,
        ).expect(400);
      } finally {
        if (previous)
          await prisma.siteSetting.update({
            where: { key: 'locale' },
            data: { value: previous.value as any },
          });
        else await prisma.siteSetting.delete({ where: { key: 'locale' } });
      }
    });
    it('keeps editable search and social metadata independent from product headings and translated content', async () => {
      const f = await fixture();
      const seo = {
        title: 'Independent SEO title',
        description: 'Independent SEO description',
        ogTitle: 'Social title',
        ogDescription: 'Social description',
        ogImage: '/images/product.jpg',
        canonical: '/en/products/' + f.product.slug + '?market=' + market,
        noindex: true,
      };
      await api('patch', `/admin/catalog/products/${f.product.id}`)
        .set(await adminHeaders())
        .send({ seo })
        .expect(200);
      const page = await api(
        'get',
        `/products/${f.product.slug}?market=${market}`,
      ).expect(200);
      expect(page.body.data).toMatchObject({ name: f.product.name, seo });
      await api('patch', `/admin/catalog/products/${f.product.id}`)
        .set(await adminHeaders())
        .send({ seo: { canonical: 'javascript:alert(1)' } })
        .expect(422);
      await api('patch', `/admin/catalog/products/${f.product.id}`)
        .set(await adminHeaders())
        .send({
          specifications: {
            material: 'Wood',
            translations: {
              zh: {
                status: 'PUBLISHED',
                name: '产品正文名称',
                summary: '正文摘要',
                specifications: { material: { label: '材料', value: '木材' } },
                seo: {
                  title: '搜索专用标题',
                  description: '搜索专用描述',
                  noindex: true,
                },
              },
            },
          },
        })
        .expect(200);
      const translated = await api(
        'get',
        `/products/${f.product.slug}?market=${market}&locale=zh`,
      ).expect(200);
      expect(translated.body.data).toMatchObject({
        name: '产品正文名称',
        seo: {
          title: '搜索专用标题',
          description: '搜索专用描述',
          noindex: true,
        },
      });
    });
    it('clears optional price-rule, coupon and market restrictions while omitted fields preserve existing restrictions', async () => {
      const f = await fixture();
      const start = '2026-01-01T00:00:00.000Z',
        end = '2027-01-01T00:00:00.000Z';
      const rule = await api('post', '/admin/pricing-rules')
        .set(await adminHeaders())
        .send({
          variantId: f.variant.id,
          scope: 'B2B_DEFAULT',
          priceCents: 800,
          market,
          currency: 'USD',
          startsAt: start,
          endsAt: end,
        })
        .expect(201);
      await api('patch', `/admin/pricing-rules/${rule.body.data.id}`)
        .set(await adminHeaders())
        .send({ priceCents: 850 })
        .expect(200);
      expect(
        await prisma.pricingRule.findUnique({
          where: { id: rule.body.data.id },
        }),
      ).toMatchObject({
        market,
        startsAt: new Date(start),
        endsAt: new Date(end),
      });
      await api('patch', `/admin/pricing-rules/${rule.body.data.id}`)
        .set(await adminHeaders())
        .send({ market: null, startsAt: null, endsAt: null })
        .expect(200);
      expect(
        await prisma.pricingRule.findUnique({
          where: { id: rule.body.data.id },
        }),
      ).toMatchObject({
        market: null,
        startsAt: null,
        endsAt: null,
        priceCents: 850,
      });
      const coupon = {
        code: couponCode,
        market,
        percentBps: 1000,
        amountCents: 0,
        minimumCents: 0,
        active: true,
      };
      await api('post', '/admin/commerce/coupons')
        .set(await adminHeaders())
        .send({
          ...coupon,
          maxUses: 20,
          perUserLimit: 3,
          startsAt: start,
          endsAt: end,
        })
        .expect(201);
      await api('post', '/admin/commerce/coupons')
        .set(await adminHeaders())
        .send({ ...coupon, active: false })
        .expect(201);
      expect(
        await prisma.retailCoupon.findUnique({ where: { code: couponCode } }),
      ).toMatchObject({
        maxUses: 20,
        perUserLimit: 3,
        startsAt: new Date(start),
        endsAt: new Date(end),
      });
      await api('post', '/admin/commerce/coupons')
        .set(await adminHeaders())
        .send({
          ...coupon,
          maxUses: null,
          perUserLimit: null,
          startsAt: null,
          endsAt: null,
        })
        .expect(201);
      expect(
        await prisma.retailCoupon.findUnique({ where: { code: couponCode } }),
      ).toMatchObject({
        maxUses: null,
        perUserLimit: null,
        startsAt: null,
        endsAt: null,
      });
      const config = {
        code: market,
        label: 'Retail isolated test market',
        currency: 'USD',
        retailEnabled: true,
        countries: [market],
        taxBps: 1000,
        shippingCents: 500,
        expressCents: 1000,
        reservationMinutes: 30,
        paymentMode: 'DEMO',
      };
      await api('post', '/admin/commerce/markets')
        .set(await adminHeaders())
        .send({ ...config, freeShippingAboveCents: 1000 })
        .expect(201);
      await api('post', '/admin/commerce/markets')
        .set(await adminHeaders())
        .send({ ...config, freeShippingAboveCents: null })
        .expect(201);
      expect(
        await prisma.retailMarket.findUnique({ where: { code: market } }),
      ).toMatchObject({ freeShippingAboveCents: null });
    });
    it('accepts MFA generated immediately before a time-step boundary on a protected catalog write', async () => {
      const f = await fixture();
      const boundary = Math.floor(Date.now() / 30_000) * 30;
      const code = await generate({ secret, epoch: boundary - 1 });
      const clock = vi.spyOn(Date, 'now').mockReturnValue(boundary * 1000 + 1);
      try {
        await api('patch', `/admin/catalog/products/${f.product.id}`)
          .set({ Authorization: `Bearer ${adminToken}`, 'x-mfa-code': code })
          .send({ summary: 'Protected update across an OTP time boundary' })
          .expect((response) => {
            expect(response.status, response.text).toBe(200);
          });
      } finally {
        clock.mockRestore();
      }
    });
    it('rejects malformed market pricing and validates required category attribute templates', async () => {
      const f = await fixture();
      await api('patch', `/admin/catalog/variants/${f.variant.id}`)
        .set(await adminHeaders())
        .send({ marketPrices: { US: { currency: 'USD', msrpCents: -1 } } })
        .expect(422);
      const category = await prisma.productCategory.create({
        data: {
          code: `TEMPLATE-${suffix}`,
          slug: `template-${suffix}`,
          name: 'Template category',
          attributeTemplate: [
            { key: 'weight', label: 'Weight', type: 'number', required: true },
          ],
          filterableFields: ['category'],
        },
      });
      try {
        await api('patch', `/admin/catalog/products/${f.product.id}`)
          .set(await adminHeaders())
          .send({ categoryId: category.id, specifications: { weight: 'bad' } })
          .expect(422);
        await api('patch', `/admin/catalog/products/${f.product.id}`)
          .set(await adminHeaders())
          .send({ categoryId: category.id, specifications: { weight: 500 } })
          .expect((response) => {
            expect(response.status, response.text).toBe(200);
          });
        await api(
          'get',
          `/products?market=${market}&categorySlug=${category.slug}&age=8`,
        ).expect(422);
      } finally {
        await prisma.productCategory.delete({ where: { id: category.id } });
      }
    });
  },
);

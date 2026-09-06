import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/bootstrap-app.js';

const runDb = process.env.E2E_DB === '1';

describe.skipIf(!runDb)('Order stock transaction flow (DB)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8).toLowerCase();
  const email = `order-${suffix}@wemove.local`;
  const password = 'Passw0rd123!';
  let userId = '';
  let productId = '';
  let variantId = '';
  let accessToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await setupApp(app);
    await app.init();

    const user = await prisma.user.create({
      data: {
        email,
        name: 'Order Tester',
        passwordHash: await hash(password, 12),
        ageConfirmed: true,
        status: 'ACTIVE',
      },
    });
    userId = user.id;
    const product = await prisma.product.create({
      data: {
        name: `Order Test ${suffix}`,
        slug: `order-test-${suffix}`,
        status: 'ACTIVE',
      },
    });
    productId = product.id;
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku: `ORDER-${suffix.toUpperCase()}`,
        name: 'Default',
        msrpCents: 1500,
        status: true,
        stock: { create: { available: 5 } },
      },
    });
    variantId = variant.id;
    await prisma.cart.create({
      data: {
        userId,
        items: {
          create: { variantId, quantity: 2, unitPriceCents: 1500 },
        },
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    accessToken = login.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app?.close();
    if (userId) {
      await prisma.order
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await prisma.cart
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    if (productId) {
      await prisma.product
        .delete({ where: { id: productId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('checkout snapshots prices, reserves stock, clears cart, and customer cancel restores stock', async () => {
    const server = app.getHttpServer();
    const checkout = await request(server)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);
    const order = checkout.body.data as {
      id: string;
      status: string;
      totalCents: number;
      items: Array<{ sku: string; quantity: number; unitPriceCents: number }>;
    };
    expect(order).toMatchObject({
      status: 'PENDING',
      totalCents: 3000,
      items: [{ quantity: 2, unitPriceCents: 1500 }],
    });

    const afterCheckout = await prisma.stock.findUniqueOrThrow({
      where: { variantId },
    });
    expect(afterCheckout).toMatchObject({ available: 3, reserved: 2 });
    expect(await prisma.cartItem.count({ where: { cart: { userId } } })).toBe(
      0,
    );

    const mine = await request(server)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(mine.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: order.id })]),
    );

    await request(server)
      .patch(`/api/v1/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);
    const afterCancel = await prisma.stock.findUniqueOrThrow({
      where: { variantId },
    });
    expect(afterCancel).toMatchObject({ available: 5, reserved: 0 });
  });
});

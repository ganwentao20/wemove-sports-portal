import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrderService } from './order.service.js';

const actor = {
  sub: 'user-1',
  kind: 'customer' as const,
  email: 'buyer@example.com',
  name: 'Buyer',
};

function setup(options?: { empty?: boolean; stockUpdateCount?: number }) {
  const item = {
    id: 'cart-item-1',
    quantity: 2,
    unitPriceCents: 1_299,
    variant: {
      id: 'variant-1',
      sku: 'WM-TEST-1',
      name: 'Blue',
      status: true,
      product: { name: 'Test Product', status: 'ACTIVE' },
      stock: { available: 5, reserved: 0 },
    },
  };
  const createdOrder = {
    id: 'order-1',
    orderNo: 'WM-TEST',
    userId: actor.sub,
    status: 'PENDING',
    subtotalCents: 2_598,
    totalCents: 2_598,
    items: [],
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'cart-1' }]),
    cart: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'cart-1',
        items: options?.empty ? [] : [item],
      }),
    },
    stock: {
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: options?.stockUpdateCount ?? 1 }),
    },
    order: { create: vi.fn().mockResolvedValue(createdOrder) },
    cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    $transaction: vi.fn().mockImplementation((callback) => callback(tx)),
  } as unknown as PrismaService;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  return { service: new OrderService(prisma, audit), tx, audit };
}

describe('OrderService checkout', () => {
  it('creates immutable line snapshots, reserves stock, and clears the cart', async () => {
    const { service, tx, audit } = setup();

    await expect(service.checkout(actor, '127.0.0.1')).resolves.toMatchObject({
      id: 'order-1',
      totalCents: 2_598,
    });
    expect(tx.stock.updateMany).toHaveBeenCalledWith({
      where: { variantId: 'variant-1', available: { gte: 2 } },
      data: { available: { decrement: 2 }, reserved: { increment: 2 } },
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalCents: 2_598,
          totalCents: 2_598,
          items: {
            create: [
              expect.objectContaining({
                productName: 'Test Product',
                sku: 'WM-TEST-1',
                quantity: 2,
                unitPriceCents: 1_299,
                lineCents: 2_598,
              }),
            ],
          },
        }),
      }),
    );
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart-1' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'order.checkout',
        actorCustomerId: actor.sub,
      }),
    );
  });

  it('rejects checkout when the cart is empty', async () => {
    const { service, tx } = setup({ empty: true });
    await expect(service.checkout(actor)).rejects.toMatchObject({
      status: 422,
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('uses a conditional stock update and rejects insufficient inventory', async () => {
    const { service, tx } = setup({ stockUpdateCount: 0 });
    await expect(service.checkout(actor)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });
});

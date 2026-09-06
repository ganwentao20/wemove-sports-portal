import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CartService } from './cart.service.js';

const customer = {
  sub: 'user-a',
  kind: 'customer' as const,
  email: 'buyer@example.com',
  name: 'Buyer',
};

function setup() {
  const cart = {
    id: 'cart-a',
    userId: 'user-a',
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prismaMock = {
    cart: {
      upsert: vi.fn().mockResolvedValue(cart),
      findUnique: vi.fn().mockResolvedValue(cart),
    },
    cartItem: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
    },
  };

  return {
    service: new CartService(prismaMock as unknown as PrismaService),
    prisma: prismaMock,
  };
}

describe('CartService', () => {
  it('always resolves the cart from the authenticated customer id', async () => {
    const { service, prisma } = setup();

    await service.getMyCart(customer);

    expect(prisma.cart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-a' },
        create: { user: { connect: { id: 'user-a' } } },
      }),
    );
  });

  it('rejects staff accounts before reading cart data', async () => {
    const { service, prisma } = setup();

    await expect(
      service.getMyCart({ ...customer, sub: 'staff-a', kind: 'staff' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.cart.upsert).not.toHaveBeenCalled();
  });

  it('rejects adding beyond the currently available stock', async () => {
    const { service, prisma } = setup();
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'variant-a',
      status: true,
      msrpCents: 1999,
      salePriceCents: null,
      stock: { available: 2 },
    });
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-a',
      cartId: 'cart-a',
      variantId: 'variant-a',
      quantity: 1,
      unitPriceCents: 1999,
    });

    await expect(
      service.addItem(customer, 'variant-a', 2),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it('rejects quantity changes when the variant has been disabled', async () => {
    const { service, prisma } = setup();
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-a',
      cartId: 'cart-a',
      variantId: 'variant-a',
      quantity: 1,
      unitPriceCents: 1999,
    });
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'variant-a',
      status: false,
      stock: { available: 10 },
    });

    await expect(
      service.updateQuantity(customer, 'variant-a', 2),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });
});

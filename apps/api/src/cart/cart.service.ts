import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { resolveRetailPrice } from '../pricing/pricing-engine.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface CartWithItems {
  id: string;
  userId: string | null;
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitPriceCents: number;
    variant: { sku: string; name: string | null; status: boolean } | null;
  }>;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyCart(actor: JwtPayload) {
    this.assertCustomer(actor);
    const cart = await this.ensureCart(actor.sub);
    return this.mapCart(cart);
  }

  async addItem(actor: JwtPayload, variantId: string, quantity: number) {
    this.assertCustomer(actor);
    if (quantity < 1) throw new BizException(ERROR_CODES.VALIDATION, 'quantity must be >= 1', 422);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { stock: true },
    });
    if (!variant || !variant.status) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'variant not available', 404);
    }
    const price = resolveRetailPrice({
      msrpCents: variant.msrpCents,
      salePriceCents: variant.salePriceCents,
    });
    if (!price) {
      throw new BizException(ERROR_CODES.VALIDATION, 'variant has no retail price', 422);
    }

    const available = variant.stock?.available ?? 0;
    const cart = await this.ensureCart(actor.sub);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const targetQty = (existing?.quantity ?? 0) + quantity;
    if (targetQty > available) {
      throw new BizException(ERROR_CODES.CONFLICT, `insufficient stock: available ${available}`, 409);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: targetQty, unitPriceCents: price.priceCents },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, variantId, quantity, unitPriceCents: price.priceCents },
      });
    }

    return this.getMyCart(actor);
  }

  async updateQuantity(actor: JwtPayload, variantId: string, quantity: number) {
    this.assertCustomer(actor);
    const cart = await this.ensureCart(actor.sub);
    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    if (!item) throw new BizException(ERROR_CODES.NOT_FOUND, 'cart item not found', 404);

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
      return this.getMyCart(actor);
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { stock: true },
    });
    const available = variant?.stock?.available ?? 0;
    if (quantity > available) {
      throw new BizException(ERROR_CODES.CONFLICT, `insufficient stock: available ${available}`, 409);
    }

    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getMyCart(actor);
  }

  async removeItem(actor: JwtPayload, variantId: string) {
    this.assertCustomer(actor);
    const cart = await this.ensureCart(actor.sub);
    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    if (!item) throw new BizException(ERROR_CODES.NOT_FOUND, 'cart item not found', 404);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getMyCart(actor);
  }

  async clear(actor: JwtPayload) {
    this.assertCustomer(actor);
    const cart = await this.prisma.cart.findUnique({ where: { userId: actor.sub } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { cleared: true as const };
  }

  private assertCustomer(actor: JwtPayload) {
    if (actor.kind !== 'customer') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'cart is for customers only', 403);
    }
  }

  private async ensureCart(userId: string): Promise<CartWithItems> {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: {
        items: {
          include: { variant: { select: { sku: true, name: true, status: true } } },
        },
      },
    }) as Promise<CartWithItems>;
  }

  private mapCart(cart: CartWithItems) {
    let totalCents = 0;
    const items = cart.items.map((it) => {
      const lineCents = it.unitPriceCents * it.quantity;
      totalCents += lineCents;
      return {
        id: it.id,
        variantId: it.variantId,
        sku: it.variant?.sku ?? null,
        name: it.variant?.name ?? null,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        lineCents,
      };
    });
    return { id: cart.id, itemCount: items.length, totalCents, items };
  }
}
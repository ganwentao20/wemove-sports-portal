import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { resolveRetailPrice } from '../pricing/pricing-engine.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { isPublicProduct, commerceError } from '../order/commerce-rules.js';
import { DEFAULT_MARKET } from '../order/commerce.service.js';
import type { ProductVariant, Stock, MarketInventory } from '@prisma/client';
import { inventoryAvailability } from '../order/inventory.service.js';

interface CartWithItems {
  id: string;
  userId: string;
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
  private async marketPrice(
    variant: ProductVariant & {
      stock: Stock | null;
      marketInventory: MarketInventory[];
    },
    marketCode: string,
  ) {
    const market =
      (await this.prisma.retailMarket.findUnique({
        where: { code: marketCode },
      })) ?? (marketCode === 'US' ? DEFAULT_MARKET : null);
    if (!market?.retailEnabled)
      commerceError('Retail ordering is closed in this market');
    const prices = variant.marketPrices as Record<
      string,
      {
        currency?: string;
        msrpCents?: number;
        salePriceCents?: number;
        startsAt?: string;
        endsAt?: string;
      }
    >;
    const selected = prices?.[marketCode],
      now = new Date();
    if (
      (market.currency !== 'USD' && selected?.currency !== market.currency) ||
      (selected?.currency && selected.currency !== market.currency) ||
      (selected?.startsAt && new Date(selected.startsAt) > now) ||
      (selected?.endsAt && new Date(selected.endsAt) <= now)
    )
      commerceError('No current retail price in this market');
    const price = resolveRetailPrice(selected ?? variant);
    return price
      ? { ...price, capacity: inventoryAvailability(variant, market).capacity }
      : null;
  }

  async getMyCart(actor: JwtPayload) {
    this.assertCustomer(actor);
    const cart = await this.ensureCart(actor.sub);
    return this.mapCart(cart);
  }

  async addItem(
    actor: JwtPayload,
    variantId: string,
    quantity: number,
    market = 'US',
  ) {
    this.assertCustomer(actor);
    if (quantity < 1)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'quantity must be >= 1',
        422,
      );

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { stock: true, product: true, marketInventory: true },
    });
    if (
      !variant ||
      !variant.status ||
      !isPublicProduct(variant.product, market)
    ) {
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'variant not available',
        404,
      );
    }
    if (variant.stock?.syncError)
      commerceError('Stock availability is awaiting synchronization');
    const price = await this.marketPrice(variant, market);
    if (!price) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'variant has no retail price',
        422,
      );
    }

    const available = price.capacity;
    const cart = await this.ensureCart(actor.sub);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const targetQty = (existing?.quantity ?? 0) + quantity;
    if (targetQty > available) {
      throw new BizException(
        ERROR_CODES.CONFLICT,
        `insufficient stock: available ${available}`,
        409,
      );
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: targetQty, unitPriceCents: price.priceCents },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
          unitPriceCents: price.priceCents,
        },
      });
    }

    return this.getMyCart(actor);
  }

  async updateQuantity(
    actor: JwtPayload,
    variantId: string,
    quantity: number,
    market = 'US',
  ) {
    this.assertCustomer(actor);
    const cart = await this.ensureCart(actor.sub);
    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    if (!item)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cart item not found', 404);

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
      return this.getMyCart(actor);
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { stock: true, product: true, marketInventory: true },
    });
    if (
      !variant ||
      !variant.status ||
      !isPublicProduct(variant.product, market)
    ) {
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'variant not available',
        404,
      );
    }
    const price = await this.marketPrice(variant, market);
    if (!price) commerceError('No current retail price in this market');
    const available = price.capacity;
    if (quantity > available) {
      throw new BizException(
        ERROR_CODES.CONFLICT,
        `insufficient stock: available ${available}`,
        409,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity, unitPriceCents: price.priceCents },
    });
    return this.getMyCart(actor);
  }

  async removeItem(actor: JwtPayload, variantId: string) {
    this.assertCustomer(actor);
    const cart = await this.ensureCart(actor.sub);
    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    if (!item)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cart item not found', 404);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getMyCart(actor);
  }

  async clear(actor: JwtPayload) {
    this.assertCustomer(actor);
    const cart = await this.prisma.cart.findUnique({
      where: { userId: actor.sub },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { cleared: true as const };
  }

  async mergeGuest(
    actor: JwtPayload,
    key: string,
    items: Array<{ variantId: string; quantity: number }>,
    market = 'US',
  ) {
    this.assertCustomer(actor);
    if (new Set(items.map((i) => i.variantId)).size !== items.length)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'duplicate variants in guest cart',
        422,
      );
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId: actor.sub },
        create: { userId: actor.sub },
        update: {},
      });
      await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "id"=${cart.id} FOR UPDATE`;
      const current = await tx.cart.findUniqueOrThrow({
        where: { id: cart.id },
      });
      if (current.mergeKeys.includes(key)) return;
      for (const line of items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          include: { stock: true, product: true, marketInventory: true },
        });
        if (
          !variant?.status ||
          !isPublicProduct(variant.product, market) ||
          variant.stock?.syncError
        )
          throw new BizException(
            ERROR_CODES.CONFLICT,
            'guest cart contains an unavailable item',
            409,
          );
        const price = await this.marketPrice(variant, market);
        if (!price)
          throw new BizException(
            ERROR_CODES.CONFLICT,
            'guest item has no current retail price',
            409,
          );
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: { cartId: cart.id, variantId: line.variantId },
          },
        });
        const quantity = (existing?.quantity ?? 0) + line.quantity;
        if (quantity > 99 || quantity > price.capacity)
          throw new BizException(
            ERROR_CODES.CONFLICT,
            `not enough stock to merge SKU ${variant.sku}; reduce the guest quantity`,
            409,
          );
        await tx.cartItem.upsert({
          where: {
            cartId_variantId: { cartId: cart.id, variantId: line.variantId },
          },
          create: {
            cartId: cart.id,
            variantId: line.variantId,
            quantity,
            unitPriceCents: price.priceCents,
          },
          update: { quantity, unitPriceCents: price.priceCents },
        });
      }
      await tx.cart.update({
        where: { id: cart.id },
        data: { mergeKeys: [...current.mergeKeys.slice(-99), key] },
      });
    });
    return this.getMyCart(actor);
  }

  private assertCustomer(actor: JwtPayload) {
    if (actor.kind !== 'customer') {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'cart is for customers only',
        403,
      );
    }
  }

  private async ensureCart(userId: string): Promise<CartWithItems> {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { user: { connect: { id: userId } } },
      update: {},
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            variant: { select: { sku: true, name: true, status: true } },
          },
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

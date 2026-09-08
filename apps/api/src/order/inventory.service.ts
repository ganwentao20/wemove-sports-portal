import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { commerceError } from './commerce-rules.js';

type Pool = {
  available: number;
  reserved?: number;
  syncError?: string | null;
  lowThreshold?: number;
};
type VariantInventory = {
  availabilityPolicy?: string;
  backorderLimit?: number;
  leadTimeDays?: number | null;
  stock: Pool | null;
  marketInventory?: Array<Pool & { market: string }>;
};
type InventoryMarket = {
  code: string;
  inventoryDisplay?: string;
  allowPreorder?: boolean;
  allowBackorder?: boolean;
};
export function inventoryAvailability(
  variant: VariantInventory,
  market: InventoryMarket,
) {
  const scoped = variant.marketInventory?.find(
    (row) => row.market === market.code,
  );
  const available = Math.min(
    variant.stock?.available ?? 0,
    scoped?.available ?? Infinity,
  );
  const stale = !!(variant.stock?.syncError || scoped?.syncError);
  const policy = variant.availabilityPolicy ?? 'IN_STOCK_ONLY';
  const allow =
    (policy === 'PREORDER' && market.allowPreorder) ||
    (policy === 'BACKORDER' && market.allowBackorder);
  const limit = allow ? (variant.backorderLimit ?? 0) : 0;
  const purchasable = !stale && available + limit > 0;
  const status = stale
    ? 'CHECK_AVAILABILITY'
    : available > 0
      ? 'IN_STOCK'
      : purchasable
        ? policy
        : 'OUT_OF_STOCK';
  const display = market.inventoryDisplay ?? 'STATUS';
  return {
    purchasable,
    capacity: stale ? 0 : Math.max(0, available + limit),
    available,
    backorderLimit: limit,
    availability: display === 'HIDDEN' && !stale ? undefined : status,
    ...(display === 'EXACT' && !stale
      ? { availableQuantity: Math.max(0, available) }
      : {}),
    ...(display === 'LEVEL' && !stale
      ? {
          inventoryLevel:
            available <= 0
              ? 'UNAVAILABLE'
              : available <=
                  (scoped?.lowThreshold ?? variant.stock?.lowThreshold ?? 5)
                ? 'LOW'
                : 'AVAILABLE',
        }
      : {}),
    ...(policy !== 'IN_STOCK_ONLY'
      ? { leadTimeDays: variant.leadTimeDays }
      : {}),
  };
}

/** Fixed lock order: global Stock first, then optional per-market allocation. */
@Injectable()
export class InventoryService {
  async lock(
    tx: Prisma.TransactionClient,
    variantIds: Array<string | null>,
    market: string,
  ) {
    for (const id of [
      ...new Set(variantIds.filter((id): id is string => !!id)),
    ].sort()) {
      await tx.$queryRaw`SELECT "variantId" FROM "Stock" WHERE "variantId"=${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT "variantId" FROM "MarketInventory" WHERE "variantId"=${id} AND "market"=${market} FOR UPDATE`;
    }
  }
  private async pools(
    tx: Prisma.TransactionClient,
    variantId: string,
    market: string,
  ) {
    await tx.$queryRaw`SELECT "variantId" FROM "Stock" WHERE "variantId"=${variantId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "variantId" FROM "MarketInventory" WHERE "variantId"=${variantId} AND "market"=${market} FOR UPDATE`;
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      include: { stock: true, marketInventory: { where: { market } } },
    });
    if (!variant?.stock) commerceError('Inventory record missing');
    const config = await tx.retailMarket.findUnique({
      where: { code: market },
    });
    return {
      variant,
      global: variant.stock,
      scoped: variant.marketInventory[0],
      config: config ?? {
        code: market,
        allowPreorder: false,
        allowBackorder: false,
      },
    };
  }
  async reserve(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    market: string,
    variantWhere?: Prisma.ProductVariantWhereInput,
  ) {
    if (!Number.isInteger(quantity) || quantity < 1)
      commerceError('Invalid stock quantity');
    const p = await this.pools(tx, variantId, market),
      state = inventoryAvailability(p.variant, p.config);
    if (!state.purchasable || state.capacity < quantity)
      commerceError(`Insufficient or unconfirmed stock for ${p.variant.sku}`);
    const result = await tx.stock.updateMany({
      where: {
        variantId,
        syncError: null,
        available: { gte: quantity - state.backorderLimit },
        ...(variantWhere ? { variant: { is: variantWhere } } : {}),
      },
      data: {
        available: { decrement: quantity },
        reserved: { increment: quantity },
      },
    });
    if (!result.count)
      commerceError(
        `Stock or product authorization changed for ${p.variant.sku}`,
      );
    if (p.scoped)
      await tx.marketInventory.update({
        where: { variantId_market: { variantId, market } },
        data: {
          available: { decrement: quantity },
          reserved: { increment: quantity },
        },
      });
  }
  async release(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    market: string,
  ) {
    const p = await this.pools(tx, variantId, market);
    if (
      p.global.reserved < quantity ||
      (p.scoped && p.scoped.reserved < quantity)
    )
      commerceError('Inventory reservation mismatch');
    await tx.stock.update({
      where: { variantId },
      data: {
        available: { increment: quantity },
        reserved: { decrement: quantity },
      },
    });
    if (p.scoped)
      await tx.marketInventory.update({
        where: { variantId_market: { variantId, market } },
        data: {
          available: { increment: quantity },
          reserved: { decrement: quantity },
        },
      });
  }
  async ship(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    market: string,
  ) {
    const p = await this.pools(tx, variantId, market);
    if (
      p.global.reserved < quantity ||
      p.global.available + p.global.reserved < quantity ||
      (p.scoped &&
        (p.scoped.reserved < quantity ||
          p.scoped.available + p.scoped.reserved < quantity))
    )
      commerceError('Replenish stock before shipping reserved backorders');
    await tx.stock.update({
      where: { variantId },
      data: { reserved: { decrement: quantity } },
    });
    if (p.scoped)
      await tx.marketInventory.update({
        where: { variantId_market: { variantId, market } },
        data: { reserved: { decrement: quantity } },
      });
  }
  async restock(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    market: string,
  ) {
    const p = await this.pools(tx, variantId, market);
    await tx.stock.update({
      where: { variantId },
      data: { available: { increment: quantity } },
    });
    if (p.scoped)
      await tx.marketInventory.update({
        where: { variantId_market: { variantId, market } },
        data: { available: { increment: quantity } },
      });
  }
}

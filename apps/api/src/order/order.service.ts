import { Injectable, Optional, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { toPaged } from '../common/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OrderQueryDto } from './dto/order.dto.js';
import { assertOrderTransition } from './order-state.js';
import { resolveRetailPrice } from '../pricing/pricing-engine.js';
import { CommerceService } from './commerce.service.js';
import { InventoryService } from './inventory.service.js';

const MAX_INT = 2_147_483_647;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly commerce?: CommerceService,
    private readonly inventory: InventoryService = new InventoryService(),
  ) {}

  async checkout(actor: JwtPayload, ip?: string) {
    this.assertCustomer(actor);
    const order = await this.prisma.$transaction(async (tx) => {
      // Serialize checkouts for the same customer cart. Without this row lock, two
      // concurrent requests could both snapshot the same lines before either clears them.
      await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "userId" = ${actor.sub} FOR UPDATE`;
      const cart = await tx.cart.findUnique({
        where: { userId: actor.sub },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
            include: { variant: { include: { product: true, stock: true } } },
          },
        },
      });
      if (!cart || cart.items.length === 0) {
        throw new BizException(ERROR_CODES.VALIDATION, 'cart is empty', 422);
      }

      let totalCents = 0;
      const snapshots: Prisma.OrderItemCreateWithoutOrderInput[] = [];
      for (const item of cart.items) {
        const variant = item.variant;
        if (!variant.status || variant.product.status !== 'ACTIVE') {
          throw new BizException(
            ERROR_CODES.CONFLICT,
            `SKU ${variant.sku} is no longer available`,
            409,
          );
        }
        const updated = await tx.stock.updateMany({
          where: { variantId: variant.id, available: { gte: item.quantity } },
          data: {
            available: { decrement: item.quantity },
            reserved: { increment: item.quantity },
          },
        });
        if (updated.count !== 1) {
          throw new BizException(
            ERROR_CODES.CONFLICT,
            `insufficient stock for SKU ${variant.sku}`,
            409,
          );
        }
        const freshPrice = resolveRetailPrice(variant);
        if (!freshPrice)
          throw new BizException(
            ERROR_CODES.CONFLICT,
            `SKU ${variant.sku} has no retail price`,
            409,
          );
        const lineCents = freshPrice.priceCents * item.quantity;
        totalCents += lineCents;
        if (!Number.isSafeInteger(totalCents) || totalCents > MAX_INT) {
          throw new BizException(
            ERROR_CODES.VALIDATION,
            'order total is too large',
            422,
          );
        }
        snapshots.push({
          variant: { connect: { id: variant.id } },
          productName: variant.product.name,
          sku: variant.sku,
          variantName: variant.name,
          quantity: item.quantity,
          unitPriceCents: freshPrice.priceCents,
          lineCents,
        });
      }

      const created = await tx.order.create({
        data: {
          orderNo: `WM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          user: { connect: { id: actor.sub } },
          subtotalCents: totalCents,
          totalCents,
          items: { create: snapshots },
        },
        include: { items: true },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    });

    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: actor.sub,
      action: 'order.checkout',
      entityType: 'order',
      entityId: order.id,
      after: { orderNo: order.orderNo, totalCents: order.totalCents },
      ip,
    });
    return order;
  }

  async listMine(actor: JwtPayload, query: OrderQueryDto) {
    this.assertCustomer(actor);
    const where = {
      userId: actor.sub,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return toPaged(items, total, query);
  }

  async getMine(actor: JwtPayload, id: string) {
    this.assertCustomer(actor);
    const order = await this.prisma.order.findFirst({
      where: { id, userId: actor.sub },
      include: { items: true },
    });
    if (!order)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'order not found', 404);
    return order;
  }

  async cancelMine(
    actor: JwtPayload,
    id: string,
    ip?: string,
    reason = 'Customer requested cancellation',
  ) {
    this.assertCustomer(actor);
    const order = await this.transition(id, 'CANCELLED', actor.sub);
    void this.commerce
      ?.notifyOrder(order.id, 'order.cancel')
      .catch(() =>
        this.logger.warn('Cancellation notification enqueue failed'),
      );
    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: actor.sub,
      action: 'order.cancel',
      entityType: 'order',
      entityId: order.id,
      before: { status: 'PENDING' },
      after: { status: order.status, reason },
      ip,
    });
    return order;
  }

  async listAdmin(query: OrderQueryDto) {
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return toPaged(items, total, query);
  }

  async exportAdmin(query: OrderQueryDto) {
    const orders = await this.prisma.order.findMany({
      where: query.status ? { status: query.status } : {},
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    const escape = (value: unknown) => {
      const s = String(value ?? '');
      return `"${(/^[=+@-]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"`;
    };
    return {
      fileName: 'orders.csv',
      count: orders.length,
      csv:
        '\uFEFF' +
        [
          [
            'Order number',
            'Customer email',
            'Status',
            'Payment',
            'Currency',
            'Total minor units',
            'Created at',
          ].join(','),
          ...orders.map((o) =>
            [
              o.orderNo,
              o.user.email,
              o.status,
              o.paymentStatus,
              o.currency,
              o.totalCents,
              o.createdAt.toISOString(),
            ]
              .map(escape)
              .join(','),
          ),
        ].join('\r\n'),
    };
  }

  async transitionAdmin(
    id: string,
    next: OrderStatus,
    actor: JwtPayload,
    ip?: string,
    reason?: string,
  ) {
    if (!reason?.trim())
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'Order status changes require a reason',
        422,
      );
    const order = await this.transition(id, next);
    void this.commerce
      ?.notifyOrder(
        order.id,
        next === 'CANCELLED' ? 'order.cancel' : 'order.status.update',
      )
      .catch(() => this.logger.warn('Order notification enqueue failed'));
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'order.status.update',
      entityType: 'order',
      entityId: order.id,
      after: { status: order.status, reason },
      ip,
    });
    return order;
  }

  private async transition(id: string, next: OrderStatus, ownerId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id, ...(ownerId ? { userId: ownerId } : {}) },
        include: { items: true },
      });
      if (!order)
        throw new BizException(ERROR_CODES.NOT_FOUND, 'order not found', 404);
      assertOrderTransition(order.status, next);
      if (next === 'CONFIRMED' && order.paymentStatus !== 'PAID')
        throw new BizException(
          ERROR_CODES.CONFLICT,
          'capture payment before confirming the order',
          409,
        );
      if (next === 'FULFILLED')
        throw new BizException(
          ERROR_CODES.CONFLICT,
          'create tracked shipments with line quantities to fulfill this order',
          409,
        );
      if (
        next === 'CANCELLED' &&
        (order.items.some((item) => item.shippedQuantity > 0) ||
          ['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus))
      )
        throw new BizException(
          ERROR_CODES.CONFLICT,
          'refund payment or request a return before cancelling',
          409,
        );
      if (ownerId && order.status !== 'PENDING') {
        throw new BizException(
          ERROR_CODES.CONFLICT,
          'customers can only cancel pending orders',
          409,
        );
      }

      if (next === 'CANCELLED') {
        await this.releaseReservation(tx, order.items, next, order.market);
        await tx.retailPayment.updateMany({
          where: { orderId: id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        if (order.couponCode)
          await tx.retailCoupon.updateMany({
            where: { code: order.couponCode, uses: { gt: 0 } },
            data: { uses: { decrement: 1 } },
          });
      }
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: next,
          ...(next === 'CANCELLED' ? { reservationExpiresAt: null } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new BizException(
          ERROR_CODES.CONFLICT,
          'order was updated concurrently',
          409,
        );
      }
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
    });
  }

  private async releaseReservation(
    tx: Prisma.TransactionClient,
    items: Array<{ variantId: string | null; quantity: number; sku: string }>,
    next: 'CANCELLED' | 'FULFILLED',
    market: string,
  ) {
    for (const item of [...items].sort((a, b) =>
      (a.variantId ?? '').localeCompare(b.variantId ?? ''),
    )) {
      if (!item.variantId) {
        throw new BizException(
          ERROR_CODES.CONFLICT,
          `cannot update stock for deleted SKU ${item.sku}`,
          409,
        );
      }
      if (next === 'CANCELLED')
        await this.inventory.release(tx, item.variantId, item.quantity, market);
      else await this.inventory.ship(tx, item.variantId, item.quantity, market);
    }
  }

  private assertCustomer(actor: JwtPayload) {
    if (actor.kind !== 'customer') {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'orders are for customers only',
        403,
      );
    }
  }
}

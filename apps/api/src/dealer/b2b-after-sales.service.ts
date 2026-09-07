import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../order/inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { B2bService } from './b2b.service.js';
import type {
  CreatePoReturnDto,
  PoAfterSalesDecisionDto,
  ReturnTrackingDto,
  ReceivePoReturnDto,
  CreatePoRefundDto,
  ConfirmPoRefundDto,
} from './dto/after-sales.dto.js';
function fail(message: string, status = 409): never {
  throw new BizException(ERROR_CODES.CONFLICT, message, status);
}
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const liveRefund = ['REQUESTED', 'PENDING', 'AWAITING_OFFLINE', 'SUCCEEDED'];
@Injectable()
export class B2bAfterSalesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(B2bAfterSalesService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly b2b: B2bService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
  ) {}
  onModuleInit() {
    if (process.env.B2B_REFUND_WORKER === 'false') return;
    this.timer = setInterval(() => {
      void this.retryPendingRefunds().catch(() =>
        this.logger.warn('Purchase order refund retry remains pending'),
      );
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actor: JwtPayload | undefined,
    action: string,
    id: string,
    data: unknown,
  ) {
    await tx.auditLog.create({
      data: {
        actorKind:
          actor?.kind === 'staff' ? 'STAFF' : actor ? 'CUSTOMER' : 'ANON',
        ...(actor?.kind === 'staff'
          ? { actorStaffId: actor.sub }
          : actor
            ? { actorCustomerId: actor.sub }
            : {}),
        action,
        entityType: 'purchaseOrder',
        entityId: id,
        after: json(data),
      },
    });
  }
  private async order(
    tx: Prisma.TransactionClient,
    id: string,
    actor?: JwtPayload,
    write = true,
  ) {
    const company =
      actor?.kind === 'customer'
        ? await this.b2b.company(actor, false, tx)
        : null;
    if (write && company?.role === 'VIEWER')
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'Read-only members cannot change after-sales records',
        403,
      );
    await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id"=${id} FOR UPDATE`;
    const order = await tx.purchaseOrder.findFirst({
      where: { id, ...(company ? { companyId: company.id } : {}) },
      include: { items: true, payments: true },
    });
    if (!order) fail('purchase order not found', 404);
    return order;
  }
  async list(actor: JwtPayload, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.order(tx, id, actor, false);
      const [returns, refunds] = await Promise.all([
        tx.purchaseOrderReturn.findMany({
          where: { orderId: id },
          include: {
            items: {
              include: {
                orderItem: { select: { sku: true, productName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        tx.purchaseOrderRefund.findMany({
          where: { orderId: id },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      const completed = refunds
          .filter((r) => r.status === 'SUCCEEDED')
          .reduce((n, r) => n + r.amountCents, 0),
        held = refunds
          .filter((r) => liveRefund.includes(r.status))
          .reduce((n, r) => n + r.amountCents, 0);
      return {
        orderId: id,
        order: {
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          totalCents: order.totalCents,
          subtotalCents: order.subtotalCents,
          taxCents: order.taxCents,
          shippingCents: order.shippingCents,
          currency: order.currency,
          market: order.market,
          items: order.items,
        },
        canWrite:
          actor.kind === 'staff' ||
          (await this.b2b.company(actor, false, tx)).role !== 'VIEWER',
        currency: order.currency,
        paidCents: order.payments
          .filter((p) => p.status === 'SUCCEEDED')
          .reduce((n, p) => n + p.amountCents, 0),
        refundedCents: completed,
        heldCents: held,
        returns,
        refunds,
      };
    });
  }
  async createReturn(actor: JwtPayload, id: string, dto: CreatePoReturnDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.order(tx, id, actor);
      if (
        new Set(dto.lines.map((l) => l.orderItemId)).size !== dto.lines.length
      )
        fail('return lines must be unique', 422);
      const prior = await tx.purchaseOrderReturn.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true },
      });
      if (prior) {
        if (
          prior.orderId !== id ||
          prior.reason !== dto.reason ||
          JSON.stringify(
            prior.items
              .map((i) => ({
                orderItemId: i.orderItemId,
                quantity: i.quantity,
              }))
              .sort((a, b) => a.orderItemId.localeCompare(b.orderItemId)),
          ) !==
            JSON.stringify(
              [...dto.lines].sort((a, b) =>
                a.orderItemId.localeCompare(b.orderItemId),
              ),
            )
        )
          fail('return key reused with different details');
        return prior;
      }
      for (const line of dto.lines) {
        const item = order.items.find((i) => i.id === line.orderItemId);
        if (!item || !item.shippedQuantity)
          fail('only shipped order items can be returned', 422);
        const allocated = await tx.purchaseOrderReturnItem.aggregate({
          where: {
            orderItemId: item.id,
            request: { status: { notIn: ['REJECTED', 'CANCELLED'] } },
          },
          _sum: { quantity: true },
        });
        if (
          line.quantity + (allocated._sum.quantity ?? 0) >
          item.shippedQuantity
        )
          fail('return quantity exceeds shipped units remaining', 422);
      }
      const request = await tx.purchaseOrderReturn.create({
        data: {
          orderId: id,
          requestedById: actor.sub,
          idempotencyKey: dto.idempotencyKey,
          reason: dto.reason,
          items: { create: dto.lines },
        },
        include: { items: true },
      });
      await this.audit(tx, actor, 'dealer.return.request', id, {
        returnId: request.id,
        reason: dto.reason,
        lines: dto.lines,
      });
      return request;
    });
    await this.b2b.notifyOrder(id, 'return-requested', result.id);
    return result;
  }
  async decideReturn(
    actor: JwtPayload,
    id: string,
    dto: PoAfterSalesDecisionDto,
  ) {
    const found = await this.prisma.purchaseOrderReturn.findUnique({
      where: { id },
    });
    if (!found) fail('return not found', 404);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.order(tx, found.orderId, actor);
      const current = await tx.purchaseOrderReturn.findUniqueOrThrow({
        where: { id },
      });
      const next = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      if (current.status === next && current.decisionReason === dto.reason)
        return current;
      if (current.status !== 'REQUESTED')
        fail('return is not awaiting a decision');
      const updated = await tx.purchaseOrderReturn.update({
        where: { id },
        data: {
          status: next,
          decisionReason: dto.reason,
          approvedById: actor.sub,
        },
      });
      await this.audit(tx, actor, 'dealer.return.decision', found.orderId, {
        returnId: id,
        status: next,
        reason: dto.reason,
      });
      return updated;
    });
    await this.b2b.notifyOrder(
      found.orderId,
      'return-' + result.status.toLowerCase(),
      id,
    );
    return result;
  }
  async trackReturn(actor: JwtPayload, id: string, dto: ReturnTrackingDto) {
    const found = await this.prisma.purchaseOrderReturn.findUnique({
      where: { id },
    });
    if (!found) fail('return not found', 404);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.order(tx, found.orderId, actor);
      const current = await tx.purchaseOrderReturn.findUniqueOrThrow({
        where: { id },
      });
      if (!['APPROVED', 'IN_TRANSIT'].includes(current.status))
        fail('return must be approved before shipment');
      const updated = await tx.purchaseOrderReturn.update({
        where: { id },
        data: { ...dto, status: 'IN_TRANSIT' },
      });
      await this.audit(tx, actor, 'dealer.return.tracking', found.orderId, {
        returnId: id,
        ...dto,
      });
      return updated;
    });
    await this.b2b.notifyOrder(found.orderId, 'return-tracking', id);
    return result;
  }
  async cancelReturn(actor: JwtPayload, id: string, reason: string) {
    const found = await this.prisma.purchaseOrderReturn.findUnique({
      where: { id },
    });
    if (!found) fail('return not found', 404);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.order(tx, found.orderId, actor);
      const current = await tx.purchaseOrderReturn.findUniqueOrThrow({
        where: { id },
      });
      if (!['REQUESTED', 'APPROVED'].includes(current.status))
        fail('return can only be withdrawn before shipment');
      const updated = await tx.purchaseOrderReturn.update({
        where: { id },
        data: { status: 'CANCELLED', decisionReason: reason },
      });
      await this.audit(tx, actor, 'dealer.return.cancel', found.orderId, {
        returnId: id,
        reason,
      });
      return updated;
    });
    await this.b2b.notifyOrder(found.orderId, 'return-withdrawn', id);
    return result;
  }
  async receiveReturn(actor: JwtPayload, id: string, dto: ReceivePoReturnDto) {
    const found = await this.prisma.purchaseOrderReturn.findUnique({
      where: { id },
    });
    if (!found) fail('return not found', 404);
    const receiptHash = createHash('sha256')
      .update(
        JSON.stringify({
          note: dto.note,
          lines: dto.lines
            .map((line) => ({
              orderItemId: line.orderItemId,
              quantity: line.quantity,
              restockQuantity: line.restockQuantity,
            }))
            .sort((a, b) => a.orderItemId.localeCompare(b.orderItemId)),
        }),
      )
      .digest('hex');
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.order(tx, found.orderId, actor);
      const current = await tx.purchaseOrderReturn.findUniqueOrThrow({
        where: { id },
        include: { items: { include: { orderItem: true } } },
      });
      const duplicateReceipt = await tx.purchaseOrderReturn.findUnique({
        where: { receiveKey: dto.receiveKey },
      });
      if (duplicateReceipt && duplicateReceipt.id !== id)
        fail('receipt key belongs to another return');
      if (current.status === 'RECEIVED') {
        if (
          current.receiveKey !== dto.receiveKey ||
          current.receiptHash !== receiptHash
        )
          fail('return receipt already finalized with different details');
        return current;
      }
      if (!['APPROVED', 'IN_TRANSIT'].includes(current.status))
        fail('return is not approved for receipt');
      if (
        dto.lines.length !== current.items.length ||
        new Set(dto.lines.map((l) => l.orderItemId)).size !== dto.lines.length
      )
        fail('confirm each approved return line exactly once', 422);
      for (const item of [...current.items].sort((a, b) =>
        a.orderItem.variantId.localeCompare(b.orderItem.variantId),
      )) {
        const line = dto.lines.find((l) => l.orderItemId === item.orderItemId);
        if (
          !line ||
          line.quantity !== item.quantity ||
          line.restockQuantity > line.quantity
        )
          fail(
            'received and restocked quantities must match the approved return',
            422,
          );
        if (line.restockQuantity)
          await this.inventory.restock(
            tx,
            item.orderItem.variantId,
            line.restockQuantity,
            order.market,
          );
        await tx.purchaseOrderReturnItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: line.quantity,
            restockQuantity: line.restockQuantity,
          },
        });
      }
      const updated = await tx.purchaseOrderReturn.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          receiveKey: dto.receiveKey,
          receiptHash,
        },
        include: { items: true },
      });
      await this.audit(tx, actor, 'dealer.return.received', order.id, {
        returnId: id,
        receiveKey: dto.receiveKey,
        note: dto.note,
        lines: dto.lines,
      });
      return updated;
    });
    await this.b2b.notifyOrder(found.orderId, 'return-received', id);
    return result;
  }
  async createRefund(actor: JwtPayload, id: string, dto: CreatePoRefundDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.order(tx, id, actor);
      const prior = await tx.purchaseOrderRefund.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (prior) {
        if (
          prior.orderId !== id ||
          prior.amountCents !== dto.amountCents ||
          prior.reason !== dto.reason ||
          prior.returnId !== (dto.returnId ?? null) ||
          prior.cancelOrder !== (dto.cancelOrder ?? false)
        )
          fail('refund key reused with different details');
        return prior;
      }
      const payment = order.payments.find((p) => p.status === 'SUCCEEDED');
      if (!payment)
        fail('a verified successful payment is required for a refund');
      const allocated = await tx.purchaseOrderRefund.aggregate({
        where: { paymentId: payment.id, status: { in: liveRefund } },
        _sum: { amountCents: true },
      });
      if (
        dto.amountCents + (allocated._sum.amountCents ?? 0) >
        payment.amountCents
      )
        fail('refund exceeds unallocated paid balance', 422);
      if (
        actor.kind === 'customer' &&
        order.items.some((i) => i.shippedQuantity > 0) &&
        !dto.returnId
      )
        fail(
          'request a return and wait for receipt before refunding shipped goods',
          422,
        );
      if (dto.cancelOrder) {
        if (order.items.some((i) => i.shippedQuantity > 0))
          fail('shipped purchase orders require a return');
        const completed = await tx.purchaseOrderRefund.aggregate({
          where: { orderId: id, status: 'SUCCEEDED' },
          _sum: { amountCents: true },
        });
        if (
          dto.amountCents + (completed._sum.amountCents ?? 0) !==
          order.totalCents
        )
          fail(
            'cancellation must refund the complete remaining order balance',
            422,
          );
      }
      if (dto.returnId) {
        const request = await tx.purchaseOrderReturn.findFirst({
          where: { id: dto.returnId, orderId: id, status: 'RECEIVED' },
          include: { items: { include: { orderItem: true } } },
        });
        if (!request)
          fail('linked return must belong to this order and be received', 422);
        const gross = request.items.reduce(
          (n, item) =>
            n + item.orderItem.unitPriceCents * item.receivedQuantity,
          0,
        );
        const discount =
          order.subtotalCents +
          order.taxCents +
          order.shippingCents -
          order.totalCents;
        const net = Math.max(
          0,
          order.subtotalCents - discount + order.taxCents,
        );
        const cap = order.subtotalCents
          ? Number((BigInt(gross) * BigInt(net)) / BigInt(order.subtotalCents))
          : 0;
        const previous = await tx.purchaseOrderRefund.aggregate({
          where: { returnId: dto.returnId, status: { in: liveRefund } },
          _sum: { amountCents: true },
        });
        if (dto.amountCents + (previous._sum.amountCents ?? 0) > cap)
          fail(
            'refund exceeds this return value after discount and tax; shipping compensation requires a separate staff refund',
            422,
          );
      }
      const refund = await tx.purchaseOrderRefund.create({
        data: {
          orderId: id,
          paymentId: payment.id,
          requestedById: actor.sub,
          idempotencyKey: dto.idempotencyKey,
          amountCents: dto.amountCents,
          currency: order.currency,
          reason: dto.reason,
          returnId: dto.returnId,
          cancelOrder: dto.cancelOrder ?? false,
        },
      });
      await this.audit(tx, actor, 'dealer.refund.request', id, {
        refundId: refund.id,
        ...dto,
      });
      return refund;
    });
    await this.b2b.notifyOrder(id, 'refund-requested', result.id);
    return result;
  }
  async cancelRefund(actor: JwtPayload, id: string, reason: string) {
    const found = await this.prisma.purchaseOrderRefund.findUnique({
      where: { id },
    });
    if (!found) fail('refund not found', 404);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.order(tx, found.orderId, actor);
      const current = await tx.purchaseOrderRefund.findUniqueOrThrow({
        where: { id },
      });
      if (current.status !== 'REQUESTED')
        fail('only an unreviewed refund request can be withdrawn');
      const updated = await tx.purchaseOrderRefund.update({
        where: { id },
        data: { status: 'CANCELLED', decisionReason: reason },
      });
      await this.audit(tx, actor, 'dealer.refund.withdraw', found.orderId, {
        refundId: id,
        reason,
      });
      return updated;
    });
    await this.b2b.notifyOrder(found.orderId, 'refund-withdrawn', id);
    return result;
  }
  async decideRefund(
    actor: JwtPayload,
    id: string,
    dto: PoAfterSalesDecisionDto,
  ) {
    const found = await this.prisma.purchaseOrderRefund.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!found) fail('refund not found', 404);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.order(tx, found.orderId, actor);
      const current = await tx.purchaseOrderRefund.findUniqueOrThrow({
        where: { id },
      });
      if (current.status !== 'REQUESTED') {
        if (
          current.decisionReason === dto.reason &&
          !['REJECTED', 'CANCELLED'].includes(current.status) &&
          current.approvedById &&
          dto.decision === 'APPROVE'
        )
          return current;
        if (
          current.status === 'REJECTED' &&
          dto.decision === 'REJECT' &&
          current.decisionReason === dto.reason
        )
          return current;
        fail('refund has already been reviewed');
      }
      const status =
        dto.decision === 'REJECT'
          ? 'REJECTED'
          : found.payment.mode === 'OFFLINE'
            ? 'AWAITING_OFFLINE'
            : 'PENDING';
      const row = await tx.purchaseOrderRefund.update({
        where: { id },
        data: {
          status,
          approvedById: actor.sub,
          decisionReason: dto.reason,
          availableAt: new Date(),
        },
      });
      await this.audit(tx, actor, 'dealer.refund.decision', found.orderId, {
        refundId: id,
        status,
        reason: dto.reason,
      });
      return row;
    });
    if (result.status === 'PENDING') await this.deliverRefund(id);
    await this.b2b.notifyOrder(found.orderId, 'refund-reviewed', id);
    return this.prisma.purchaseOrderRefund.findUniqueOrThrow({ where: { id } });
  }
  async confirmOfflineRefund(
    actor: JwtPayload,
    id: string,
    dto: ConfirmPoRefundDto,
  ) {
    const refund = await this.prisma.purchaseOrderRefund.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!refund || refund.payment.mode !== 'OFFLINE')
      fail('offline refund not found', 404);
    if (refund.amountCents !== dto.amountCents)
      fail('confirm the exact approved refund amount', 422);
    if (refund.status === 'SUCCEEDED') {
      if (refund.providerReference !== dto.providerReference)
        fail('refund already recorded with another transfer reference');
      return refund;
    }
    if (refund.status !== 'AWAITING_OFFLINE')
      fail('offline refund is not approved');
    await this.completeRefund(id, dto.providerReference, actor);
    return this.prisma.purchaseOrderRefund.findUniqueOrThrow({ where: { id } });
  }
  private async completeRefund(
    id: string,
    reference: string,
    actor?: JwtPayload,
  ) {
    const found = await this.prisma.purchaseOrderRefund.findUniqueOrThrow({
      where: { id },
    });
    const changed = await this.prisma.$transaction(async (tx) => {
      const order = await this.order(tx, found.orderId);
      const refund = await tx.purchaseOrderRefund.findUniqueOrThrow({
        where: { id },
      });
      if (refund.status === 'SUCCEEDED') {
        if (refund.providerReference !== reference)
          fail('refund provider reference conflict');
        return false;
      }
      if (!['PENDING', 'AWAITING_OFFLINE'].includes(refund.status))
        fail('refund is not approved for completion');
      await tx.purchaseOrderRefund.update({
        where: { id },
        data: {
          status: 'SUCCEEDED',
          providerReference: reference,
          completedAt: new Date(),
          lastError: null,
        },
      });
      const total = await tx.purchaseOrderRefund.aggregate({
        where: { orderId: order.id, status: 'SUCCEEDED' },
        _sum: { amountCents: true },
      });
      const refunded = total._sum.amountCents ?? 0;
      if (refunded > order.totalCents)
        fail('refund total exceeds original payment');
      if (refund.cancelOrder) {
        if (
          order.items.some((i) => i.shippedQuantity > 0) ||
          refunded !== order.totalCents
        )
          fail('purchase order cancellation changed during refund');
        if (order.inventoryReserved)
          for (const item of [...order.items].sort((a, b) =>
            a.variantId.localeCompare(b.variantId),
          ))
            await this.inventory.release(
              tx,
              item.variantId,
              item.quantity,
              order.market,
            );
      }
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus:
            refunded === order.totalCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          ...(refund.cancelOrder
            ? {
                status: 'CANCELLED',
                inventoryReserved: false,
                cancellationReason: refund.reason,
              }
            : {}),
        },
      });
      await this.audit(tx, actor, 'dealer.refund.completed', order.id, {
        refundId: id,
        amountCents: refund.amountCents,
        reference,
        cancelOrder: refund.cancelOrder,
      });
      return true;
    });
    if (changed) await this.b2b.notifyOrder(found.orderId, 'refund', id);
  }
  async deliverRefund(id: string, retry = false) {
    const claim = await this.prisma.purchaseOrderRefund.updateMany({
      where: {
        id,
        status: 'PENDING',
        ...(retry
          ? {
              OR: [
                { availableAt: { lte: new Date() } },
                { lastError: { not: null } },
              ],
            }
          : { availableAt: { lte: new Date() } }),
      },
      data: {
        availableAt: new Date(Date.now() + 60000),
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (!claim.count) return;
    const refund = await this.prisma.purchaseOrderRefund.findUniqueOrThrow({
      where: { id },
      include: { payment: true },
    });
    try {
      if (refund.payment.mode === 'DEMO') {
        if (
          process.env.NODE_ENV === 'production' &&
          process.env.ALLOW_DEMO_PAYMENTS !== 'true'
        )
          throw new Error('demo disabled');
        await this.completeRefund(id, 'DEMO-REFUND-' + id);
        return;
      }
      const endpoint = process.env.B2B_PAYMENT_REFUND_URL,
        secret = process.env.B2B_PAYMENT_WEBHOOK_SECRET;
      if (!endpoint || !secret) throw new Error('provider unavailable');
      const url = new URL(endpoint);
      if (
        url.protocol !== 'https:' &&
        !(
          process.env.NODE_ENV !== 'production' &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        )
      )
        throw new Error('provider endpoint must use HTTPS');
      const body = JSON.stringify({
        refundId: id,
        idempotencyKey: id,
        orderId: refund.orderId,
        paymentId: refund.paymentId,
        paymentReference: refund.payment.providerReference,
        amountCents: refund.amountCents,
        currency: refund.currency,
        reason: refund.reason,
      });
      const timestamp = String(Date.now());
      const signature = createHmac('sha256', secret)
        .update(timestamp + '.' + body)
        .digest('hex');
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': id,
          'x-payment-timestamp': timestamp,
          'x-payment-signature': signature,
          ...(process.env.B2B_PAYMENT_API_TOKEN
            ? { authorization: 'Bearer ' + process.env.B2B_PAYMENT_API_TOKEN }
            : {}),
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('provider failed');
      const payload = (await response.json()) as {
        status?: string;
        providerReference?: string;
        amountCents?: number;
        currency?: string;
      };
      if (
        payload.status !== 'SUCCEEDED' ||
        !payload.providerReference ||
        payload.providerReference.length > 160 ||
        payload.amountCents !== refund.amountCents ||
        payload.currency !== refund.currency
      )
        throw new Error('provider has not confirmed this refund');
      await this.completeRefund(id, payload.providerReference);
    } catch {
      await this.prisma.purchaseOrderRefund.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          lastError: 'PROVIDER_REFUND_UNCONFIRMED',
          availableAt: new Date(
            Date.now() +
              Math.min(86400000, 60000 * 2 ** Math.min(refund.attempts, 10)),
          ),
        },
      });
      await this.notifications.enqueueInternal({
        kind: 'dealer.refund.retry',
        subject: 'Purchase order refund needs retry',
        text: 'Purchase order refund remains unconfirmed. Review the B2B after-sales queue.',
        dedupeKey: 'dealer.refund.alert:' + id + ':' + refund.attempts,
        group: 'orders',
        variables: { reference: id },
      });
    }
  }
  async retryRefund(actor: JwtPayload, id: string) {
    const found = await this.prisma.purchaseOrderRefund.findUnique({
      where: { id },
    });
    if (!found) fail('refund not found', 404);
    if (found.status !== 'PENDING')
      fail('only pending provider refunds can be retried');
    if (!found.lastError && found.availableAt > new Date())
      fail('refund delivery is already in progress');
    await this.prisma.$transaction((tx) =>
      this.audit(tx, actor, 'dealer.refund.retry', found.orderId, {
        refundId: id,
      }),
    );
    await this.deliverRefund(id, true);
    return this.prisma.purchaseOrderRefund.findUniqueOrThrow({ where: { id } });
  }
  async retryPendingRefunds() {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.prisma.purchaseOrderRefund.findMany({
        where: { status: 'PENDING', availableAt: { lte: new Date() } },
        take: 20,
        orderBy: { availableAt: 'asc' },
      });
      for (const row of pending) await this.deliverRefund(row.id);
    } finally {
      this.running = false;
    }
  }
}

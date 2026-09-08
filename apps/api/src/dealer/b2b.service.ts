import { Injectable, Optional } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { purchaseOrderPdf } from './b2b-pdf.js';
import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { DealerService } from './dealer.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  InventoryService,
  inventoryAvailability,
} from '../order/inventory.service.js';
import {
  catalogWhere,
  catalogVariantWhere,
  purchaseRule,
} from './catalog-policy.js';
import type { QuickOrderLineDto } from './dto/quick-order.dto.js';
import type { PoShipmentDto } from './dto/portal.dto.js';
import type {
  AcceptQuoteDto,
  StaffCreatePurchaseOrderDto,
  CreateQuoteDto,
  CreateRfqDto,
  AdjustPurchaseOrderDto,
} from './dto/b2b.dto.js';

type ItemSnapshot = {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: number;
  lineCents: number;
};
const details = {
  quotes: { orderBy: { version: 'desc' as const } },
  purchaseOrder: { include: { items: true } },
};
const MAX_INT = 2147483647;
function conflict(message: string): never {
  throw new BizException(ERROR_CODES.CONFLICT, message, 409);
}
function invalid(message: string): never {
  throw new BizException(ERROR_CODES.VALIDATION, message, 422);
}
export function checkedTotal(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (
    values.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    !Number.isSafeInteger(total) ||
    total > MAX_INT
  )
    invalid('amount exceeds supported integer range');
  return total;
}
export function assertPoTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
) {
  const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
    PENDING_REVIEW: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING'],
    PROCESSING: ['SHIPPED'],
    SHIPPED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  };
  if (!allowed[from].includes(to))
    conflict(`invalid purchase order transition: ${from} -> ${to}`);
}

/** M1/MB (甘文韬)：企业实时权限、不可变报价、幂等转单与库存事务。 */
@Injectable()
export class B2bService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dealer: DealerService,
    private readonly inventory: InventoryService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async company(
    actor: JwtPayload,
    write = false,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (actor.kind !== 'customer' || !actor.companyId)
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'approved dealer membership required',
        403,
      );
    const member = await db.dealerMember.findUnique({
      where: {
        companyId_userId: { companyId: actor.companyId, userId: actor.sub },
      },
      include: { company: true, user: { select: { status: true } } },
    });
    if (
      !member ||
      member.active === false ||
      member.company.status !== 'APPROVED' ||
      member.user.status !== 'ACTIVE' ||
      (write && member.role === 'VIEWER')
    )
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'current company membership does not permit this operation',
        403,
      );
    if (
      write &&
      (member.company.purchaseSettings as Record<string, unknown>)
        .orderSuspended === true
    )
      conflict('company ordering is suspended; contact sales');
    return { ...member.company, role: member.role };
  }

  async createRfq(actor: JwtPayload, dto: CreateRfqDto) {
    if (
      dto.targetDeliveryAt &&
      new Date(dto.targetDeliveryAt).getTime() < Date.now()
    )
      invalid('target delivery must be in the future');
    if (dto.attachmentIds?.length) {
      const files = await this.prisma.mediaAsset.count({
        where: {
          id: { in: dto.attachmentIds },
          visibility: 'DEALER_ONLY',
          companyIds: { has: actor.companyId ?? '' },
          qualification: false,
        },
      });
      if (files !== dto.attachmentIds.length)
        invalid('RFQ attachments must be uploaded by your company');
    }
    const preview = await this.dealer.validateQuickOrder(dto.lines, actor);
    if (!preview.valid)
      invalid(
        'Quick Order contains invalid rows; validate and correct all rows first',
      );
    const items: ItemSnapshot[] = preview.results.flatMap((line) =>
      line.ok
        ? [
            {
              variantId: line.variantId,
              sku: line.sku,
              productName: line.productName,
              variantName: line.variantName,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              lineCents: line.lineTotalCents,
            },
          ]
        : [],
    );
    checkedTotal(items.map((item) => item.lineCents));
    return this.prisma.$transaction(async (tx) => {
      const company = await this.company(actor, true, tx);
      const rfq = await tx.dealerRfq.create({
        data: {
          companyId: company.id,
          createdById: actor.sub,
          title: dto.title,
          note: dto.note,
          targetDeliveryAt: dto.targetDeliveryAt
            ? new Date(dto.targetDeliveryAt)
            : null,
          attachmentIds: dto.attachmentIds ?? [],
          items,
        },
        include: details,
      });
      await this.audit(tx, actor, 'dealer.rfq.create', rfq.id, {
        status: rfq.status,
      });
      return rfq;
    });
  }

  async listRfqs(actor: JwtPayload) {
    const company = await this.company(actor);
    return {
      company,
      items: (
        await this.prisma.dealerRfq.findMany({
          where: { companyId: company.id },
          include: details,
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      ).map((rfq) => this.effectiveRfq(rfq)),
    };
  }
  async listAdminRfqs() {
    return (
      await this.prisma.dealerRfq.findMany({
        include: {
          ...details,
          company: {
            select: { id: true, companyName: true, purchaseSettings: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    ).map((rfq) => this.effectiveRfq(rfq));
  }
  private effectiveRfq<
    T extends { status: string; quotes: Array<{ validUntil: Date }> },
  >(rfq: T): T {
    return rfq.status === 'QUOTED' &&
      rfq.quotes[0] &&
      rfq.quotes[0].validUntil.getTime() <= Date.now()
      ? { ...rfq, status: 'EXPIRED' }
      : rfq;
  }
  private async lockedRfq(
    tx: Prisma.TransactionClient,
    id: string,
    companyId?: string,
  ) {
    // The same RFQ row serializes submit/requote/accept/reject. Ownership is part of the lock query.
    if (companyId)
      await tx.$queryRaw`SELECT "id" FROM "DealerRfq" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
    else
      await tx.$queryRaw`SELECT "id" FROM "DealerRfq" WHERE "id" = ${id} FOR UPDATE`;
    const rfq = await tx.dealerRfq.findFirst({
      where: { id, ...(companyId ? { companyId } : {}) },
      include: details,
    });
    if (!rfq)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'RFQ not found', 404);
    return rfq;
  }
  async submitRfq(actor: JwtPayload, id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const company = await this.company(actor, true, tx);
      const rfq = await this.lockedRfq(tx, id, company.id);
      if (rfq.status !== 'DRAFT') conflict('only draft RFQs can be submitted');
      const updated = await tx.dealerRfq.update({
        where: { id },
        data: { status: 'SUBMITTED' },
        include: details,
      });
      await this.audit(tx, actor, 'dealer.rfq.submit', id, {
        status: 'SUBMITTED',
      });
      return updated;
    });
    await this.notify(id, 'submitted');
    return result;
  }
  async quote(actor: JwtPayload, id: string, dto: CreateQuoteDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const rfq = await this.lockedRfq(tx, id);
      const status = this.effectiveRfq(rfq).status;
      if (!['SUBMITTED', 'QUOTED'].includes(status))
        conflict('RFQ is not open for quotation');
      if (dto.revision !== rfq.revision)
        conflict('RFQ has a newer quote; refresh before quoting');
      const company = await tx.dealerCompany.findUniqueOrThrow({
        where: { id: rfq.companyId },
      });
      if (company.status !== 'APPROVED') conflict('company is not approved');
      const validUntil = new Date(dto.validUntil);
      if (
        !Number.isFinite(validUntil.getTime()) ||
        validUntil.getTime() <= Date.now()
      )
        invalid('quote expiry must be in the future');
      const source = rfq.items as unknown as ItemSnapshot[];
      if (
        (await tx.productVariant.count({
          where: {
            AND: [
              { id: { in: source.map((i) => i.variantId) } },
              catalogVariantWhere(company.catalogPolicy),
            ],
            status: true,
            product: {
              ...catalogWhere(company.catalogPolicy, company.country),
            },
          },
        })) !== source.length
      )
        conflict('requested product authorization changed');
      const prices = new Map(
        dto.lines.map((line) => [
          line.sku.trim().toUpperCase(),
          line.unitPriceCents,
        ]),
      );
      if (
        prices.size !== dto.lines.length ||
        prices.size !== source.length ||
        source.some((item) => !prices.has(item.sku))
      )
        invalid('quote must include each requested SKU exactly once');
      const items = source.map((item) => {
        const unitPriceCents = prices.get(item.sku)!;
        return {
          ...item,
          unitPriceCents,
          lineCents: checkedTotal([unitPriceCents * item.quantity]),
        };
      });
      const subtotalCents = checkedTotal(items.map((item) => item.lineCents));
      const grossCents = checkedTotal([
        subtotalCents,
        dto.taxCents,
        dto.shippingCents,
      ]);
      const discountCents = dto.discountCents ?? 0;
      if (discountCents > subtotalCents) invalid('discount exceeds subtotal');
      const totalCents = grossCents - discountCents;
      await tx.dealerQuote.create({
        data: {
          rfqId: id,
          version: rfq.revision + 1,
          items,
          subtotalCents,
          taxCents: dto.taxCents,
          shippingCents: dto.shippingCents,
          discountCents,
          paymentTerms: dto.paymentTerms ?? 'PREPAID',
          deliveryTerms: dto.deliveryTerms,
          totalCents,
          currency: String(
            (company.purchaseSettings as Record<string, unknown>).currency ??
              'USD',
          ),
          validUntil,
          quotedById: actor.sub,
        },
      });
      const updated = await tx.dealerRfq.update({
        where: { id },
        data: { status: 'QUOTED', revision: { increment: 1 } },
        include: details,
      });
      await this.audit(tx, actor, 'dealer.rfq.quote', id, {
        version: updated.revision,
        totalCents,
      });
      return updated;
    });
    await this.notify(id, 'quoted');
    return result;
  }
  async rejectQuote(
    actor: JwtPayload,
    id: string,
    version: number,
    reason?: string,
  ) {
    if (!reason?.trim()) invalid('rejection reason is required');
    const result = await this.prisma.$transaction(async (tx) => {
      const company = await this.company(actor, true, tx);
      const rfq = await this.lockedRfq(tx, id, company.id);
      if (
        this.effectiveRfq(rfq).status !== 'QUOTED' ||
        rfq.revision !== version
      )
        conflict('only the latest valid quote can be rejected');
      const updated = await tx.dealerRfq.update({
        where: { id },
        data: { status: 'REJECTED', rejectionReason: reason!.trim() },
        include: details,
      });
      await this.audit(tx, actor, 'dealer.rfq.reject', id, { version });
      return updated;
    });
    await this.notify(id, 'rejected');
    return result;
  }
  async acceptQuote(actor: JwtPayload, id: string, dto: AcceptQuoteDto) {
    return this.convertQuote(actor, id, dto);
  }
  async createStaffOrder(
    actor: JwtPayload,
    id: string,
    dto: StaffCreatePurchaseOrderDto,
  ) {
    if (actor.kind !== 'staff')
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'Staff ordering requires a staff session',
        403,
      );
    return this.convertQuote(actor, id, dto, dto.staffReason);
  }
  private async convertQuote(
    actor: JwtPayload,
    id: string,
    dto: AcceptQuoteDto,
    staffReason?: string,
  ) {
    const addressKey = (address: AcceptQuoteDto['shippingAddress']) => [
      address.recipient,
      address.phone,
      address.country,
      address.city,
      address.addressLine,
      address.postalCode,
    ];
    const requestHash = staffReason
      ? createHash('sha256')
          .update(
            JSON.stringify([
              staffReason,
              dto.version,
              addressKey(dto.shippingAddress),
              addressKey(dto.billingAddress ?? dto.shippingAddress),
              dto.customerPoNumber?.trim() ?? '',
              dto.paymentMethod ?? 'BANK_TRANSFER',
            ]),
          )
          .digest('hex')
      : undefined;
    const result = await this.prisma.$transaction(async (tx) => {
      const memberCompany = staffReason
        ? null
        : await this.company(actor, true, tx);
      const rfq = await this.lockedRfq(tx, id, memberCompany?.id);
      const company =
        memberCompany ??
        (await tx.dealerCompany.findUniqueOrThrow({
          where: { id: rfq.companyId },
        }));
      if (company.status !== 'APPROVED') conflict('company is not approved');
      // Retry after a lost response returns the original PO without reserving stock again.
      if (rfq.purchaseOrder) {
        if (rfq.purchaseOrder.quoteVersion !== dto.version)
          conflict('quote version differs from the accepted order');
        if (staffReason) {
          const history = rfq.purchaseOrder.adjustments as Array<
            Record<string, unknown>
          >;
          if (
            !history.some(
              (entry) =>
                entry.action === 'STAFF_CREATE' &&
                entry.actorId === actor.sub &&
                entry.requestHash === requestHash,
            )
          )
            conflict(
              'purchase order already created with another authorization',
            );
        }
        return rfq.purchaseOrder;
      }
      const quote = rfq.quotes[0];
      if (
        this.effectiveRfq(rfq).status !== 'QUOTED' ||
        !quote ||
        quote.version !== dto.version
      )
        conflict('only the latest unexpired quote can be accepted');
      if (!dto.shippingAddress) invalid('shipping address is required');
      const settings = company.purchaseSettings as Record<string, unknown>;
      if (settings.orderSuspended === true)
        conflict('company ordering is suspended; contact sales');
      if (settings.requirePoNumber === true && !dto.customerPoNumber?.trim())
        invalid('customer PO number is required');
      const method = dto.paymentMethod ?? 'BANK_TRANSFER';
      const allowed = Array.isArray(settings.paymentMethods)
        ? settings.paymentMethods
        : ['BANK_TRANSFER', 'PO', 'ACCOUNT'];
      if (!allowed.includes(method))
        invalid('payment method is not enabled for this company');
      if (
        method === 'CARD' &&
        process.env.B2B_PAYMENT_MODE !== 'DEMO' &&
        (!process.env.B2B_PAYMENT_CREATE_URL ||
          !process.env.B2B_PAYMENT_WEBHOOK_SECRET)
      )
        invalid(
          'B2B card provider is not configured; select an approved invoice method',
        );
      if (
        method === 'CARD' &&
        process.env.B2B_PAYMENT_MODE === 'DEMO' &&
        process.env.NODE_ENV === 'production' &&
        process.env.ALLOW_DEMO_PAYMENTS !== 'true'
      )
        invalid('demo card payments are disabled in production');
      const items = quote.items as unknown as ItemSnapshot[];
      await this.inventory.lock(
        tx,
        items.map((item) => item.variantId),
        company.country,
      );
      const variants = await tx.productVariant.findMany({
        where: {
          AND: [
            { id: { in: items.map((item) => item.variantId) } },
            catalogVariantWhere(company.catalogPolicy),
          ],
          status: true,
          product: catalogWhere(company.catalogPolicy, company.country),
        },
        include: {
          stock: true,
          marketInventory: { where: { market: company.country } },
        },
      });
      if (variants.length !== items.length)
        conflict('quoted product authorization changed');
      const market = await tx.retailMarket.findUnique({
        where: { code: company.country },
      });
      for (const item of items) {
        const variant = variants.find((row) => row.id === item.variantId)!;
        const rule = purchaseRule(company.purchaseSettings, item.sku);
        if (
          item.quantity < rule.moq ||
          item.quantity % rule.multiple ||
          item.quantity % rule.caseSize
        )
          conflict(
            'quoted quantities no longer satisfy company purchasing rules',
          );
        if (
          inventoryAvailability(variant, market ?? { code: company.country })
            .capacity < item.quantity
        )
          conflict('insufficient or unconfirmed inventory for quoted quantity');
      }
      const reserveNow =
        (company.purchaseSettings as Record<string, unknown>).reserveAt !==
        'CONFIRM';
      // Consistent SKU lock order prevents opposing multi-line purchases deadlocking.
      for (const item of (reserveNow ? [...items] : []).sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      )) {
        await this.inventory.reserve(
          tx,
          item.variantId,
          item.quantity,
          company.country,
          {
            status: true,
            ...catalogVariantWhere(company.catalogPolicy),
            product: {
              ...catalogWhere(company.catalogPolicy, company.country),
            },
          },
        );
      }
      const order = await tx.purchaseOrder.create({
        data: {
          orderNo: `PO-${randomUUID().toUpperCase()}`,
          companyId: company.id,
          companyName: company.companyName,
          market: company.country,
          inventoryReserved: reserveNow,
          createdById: staffReason ? rfq.createdById : actor.sub,
          ...(staffReason
            ? {
                adjustments: [
                  {
                    at: new Date().toISOString(),
                    action: 'STAFF_CREATE',
                    actorId: actor.sub,
                    reason: staffReason,
                    requestHash: requestHash!,
                    rfqId: id,
                    quoteVersion: dto.version,
                  },
                ],
              }
            : {}),
          rfqId: id,
          quoteVersion: quote.version,
          shippingAddress: { ...dto.shippingAddress },
          billingAddress: { ...(dto.billingAddress ?? dto.shippingAddress) },
          customerPoNumber: dto.customerPoNumber?.trim(),
          paymentMethod: method,
          paymentTerms: quote.paymentTerms,
          subtotalCents: quote.subtotalCents,
          taxCents: quote.taxCents,
          shippingCents: quote.shippingCents,
          totalCents: quote.totalCents,
          currency: quote.currency,
          items: { create: items },
        },
        include: { items: true },
      });
      await tx.dealerRfq.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      });
      await this.audit(
        tx,
        actor,
        staffReason ? 'dealer.po.manual.create' : 'dealer.rfq.accept',
        staffReason ? order.id : id,
        {
          orderId: order.id,
          rfqId: id,
          version: quote.version,
          totalCents: order.totalCents,
          ...(staffReason
            ? {
                reason: staffReason,
                customerId: rfq.createdById,
                requestHash: requestHash!,
              }
            : {}),
        },
      );
      return order;
    });
    if (staffReason) await this.notifyOrder(result.id, 'manual-create');
    else await this.notify(id, 'accepted');
    return result;
  }
  async listOrders(actor?: JwtPayload) {
    const company = actor ? await this.company(actor) : null;
    return this.prisma.purchaseOrder.findMany({
      where: company ? { companyId: company.id } : {},
      include: { items: true, shipments: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async transitionOrder(
    actor: JwtPayload,
    id: string,
    next: PurchaseOrderStatus,
    reason?: string,
  ) {
    if (next === 'CANCELLED' && !reason?.trim())
      invalid('a cancellation reason is required');
    const result = await this.prisma.$transaction(async (tx) => {
      const company =
        actor.kind === 'customer' ? await this.company(actor, true, tx) : null;
      if (company && next !== 'CANCELLED')
        throw new BizException(
          ERROR_CODES.FORBIDDEN,
          'dealer can only cancel pending purchase orders',
          403,
        );
      if (company)
        await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} AND "companyId" = ${company.id} FOR UPDATE`;
      else
        await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findFirst({
        where: { id, ...(company ? { companyId: company.id } : {}) },
        include: { items: true },
      });
      if (!order)
        throw new BizException(
          ERROR_CODES.NOT_FOUND,
          'purchase order not found',
          404,
        );
      if (
        next !== 'CANCELLED' &&
        (await tx.purchaseOrderRefund.count({
          where: {
            orderId: id,
            cancelOrder: true,
            status: { in: ['REQUESTED', 'PENDING', 'AWAITING_OFFLINE'] },
          },
        }))
      )
        conflict('order has a cancellation refund awaiting resolution');
      if (
        next === 'CANCELLED' &&
        ['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)
      )
        conflict(
          'paid purchase order requires a complete refund before cancellation',
        );
      assertPoTransition(order.status, next);
      if (next === 'SHIPPED')
        conflict(
          'record a shipment with carrier, tracking number and line quantities to mark this order shipped',
        );
      if (
        next === 'CONFIRMED' &&
        order.paymentMethod === 'CARD' &&
        order.paymentStatus !== 'PAID'
      )
        conflict('card purchase order must be paid before confirmation');
      if (next === 'CANCELLED' && order.paymentStatus === 'PAID')
        conflict('paid purchase order requires a refund before cancellation');
      if (next === 'CONFIRMED') {
        const currentCompany = await tx.dealerCompany.findUniqueOrThrow({
          where: { id: order.companyId },
        });
        if (currentCompany.status !== 'APPROVED')
          conflict('company is not approved');
        if (!order.inventoryReserved)
          for (const item of [...order.items].sort((a, b) =>
            a.variantId.localeCompare(b.variantId),
          )) {
            await this.inventory.reserve(
              tx,
              item.variantId,
              item.quantity,
              order.market,
              {
                status: true,
                ...catalogVariantWhere(currentCompany.catalogPolicy),
                product: catalogWhere(
                  currentCompany.catalogPolicy,
                  order.market,
                ),
              },
            );
          }
      }
      if (next === 'CANCELLED' && order.inventoryReserved) {
        for (const item of [...order.items].sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        )) {
          await this.inventory.release(
            tx,
            item.variantId,
            item.quantity - item.shippedQuantity,
            order.market,
          );
        }
      }
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: next,
          ...(next === 'CONFIRMED' ? { inventoryReserved: true } : {}),
          ...(next === 'CANCELLED'
            ? { inventoryReserved: false, cancellationReason: reason!.trim() }
            : {}),
        },
        include: { items: true },
      });
      await this.audit(tx, actor, 'dealer.po.transition', id, {
        before: order.status,
        status: next,
        reason: reason ?? null,
      });
      return updated;
    });
    await this.notifyOrder(id, next.toLowerCase());
    return result;
  }
  async adjustOrder(
    actor: JwtPayload,
    id: string,
    dto: AdjustPurchaseOrderDto,
  ) {
    const { reason, ...changes } = dto;
    if (!reason.trim() || !Object.keys(changes).length)
      invalid('an adjustment needs a reason and changed fields');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id"=${id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (
        !order ||
        !['PENDING_REVIEW', 'CONFIRMED', 'PROCESSING'].includes(order.status) ||
        order.items.some((item) => item.shippedQuantity > 0)
      )
        conflict('only unshipped open purchase orders can be adjusted');
      const company = await tx.dealerCompany.findUniqueOrThrow({
        where: { id: order.companyId },
      });
      if (
        (company.purchaseSettings as Record<string, unknown>).requirePoNumber &&
        changes.customerPoNumber !== undefined &&
        !changes.customerPoNumber.trim()
      )
        invalid('customer PO number is required');
      const history = Array.isArray(order.adjustments) ? order.adjustments : [];
      const before = Object.fromEntries(
        Object.keys(changes).map((key) => [
          key,
          order[key as keyof typeof order],
        ]),
      );
      const entry = JSON.parse(
        JSON.stringify({
          at: new Date().toISOString(),
          actorId: actor.sub,
          reason: reason.trim(),
          before,
          changes,
        }),
      );
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          ...changes,
          shippingAddress: changes.shippingAddress
            ? { ...changes.shippingAddress }
            : undefined,
          billingAddress: changes.billingAddress
            ? { ...changes.billingAddress }
            : undefined,
          adjustments: [...history, entry] as Prisma.InputJsonArray,
        },
      });
      await this.audit(tx, actor, 'dealer.po.adjust', id, entry);
      return updated;
    });
    await this.notifyOrder(id, 'adjusted');
    return result;
  }
  async priceBookOptions() {
    const [books, companies] = await Promise.all([
      this.prisma.priceBook.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.dealerCompany.findMany({
        where: { status: 'APPROVED' },
        select: {
          id: true,
          companyName: true,
          priceBooks: { select: { bookId: true } },
        },
        orderBy: { companyName: 'asc' },
      }),
    ]);
    return { books, companies };
  }
  async createPriceBook(actor: JwtPayload, code: string, label: string) {
    if (!code.trim() || !label.trim())
      invalid('price book code and label required');
    return this.prisma.$transaction(async (tx) => {
      if (await tx.priceBook.findUnique({ where: { code: code.trim() } }))
        conflict('price book code already exists');
      const book = await tx.priceBook.create({
        data: { code: code.trim(), label: label.trim() },
      });
      await this.audit(tx, actor, 'dealer.pricebook.create', book.id, {
        code: book.code,
      });
      return book;
    });
  }
  async assignBooks(actor: JwtPayload, companyId: string, bookIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DealerCompany" WHERE "id" = ${companyId} FOR UPDATE`;
      if (
        !(await tx.dealerCompany.findFirst({
          where: { id: companyId, status: 'APPROVED' },
        }))
      )
        throw new BizException(
          ERROR_CODES.NOT_FOUND,
          'approved company not found',
          404,
        );
      if (
        (await tx.priceBook.count({ where: { id: { in: bookIds } } })) !==
        bookIds.length
      )
        invalid('unknown or duplicate price book');
      const before = await tx.dealerPriceBook.findMany({
        where: { companyId },
        select: { bookId: true },
      });
      await tx.dealerPriceBook.deleteMany({ where: { companyId } });
      await tx.dealerPriceBook.createMany({
        data: bookIds.map((bookId) => ({ companyId, bookId })),
      });
      await this.audit(tx, actor, 'dealer.pricebook.assign', companyId, {
        before: before.map((item) => item.bookId),
        bookIds,
      });
      return { companyId, bookIds };
    });
  }
  async cart(actor: JwtPayload, lines?: QuickOrderLineDto[]) {
    const company = await this.company(actor, Boolean(lines));
    if (lines) {
      const preview = await this.dealer.validateQuickOrder(lines, actor);
      if (!preview.valid) invalid('correct cart row errors before saving');
      return this.prisma.dealerProcurementCart.upsert({
        where: { userId: actor.sub },
        create: {
          userId: actor.sub,
          companyId: company.id,
          lines: JSON.parse(JSON.stringify(lines)),
        },
        update: {
          companyId: company.id,
          lines: JSON.parse(JSON.stringify(lines)),
        },
      });
    }
    const cart = await this.prisma.dealerProcurementCart.findFirst({
      where: { userId: actor.sub, companyId: company.id },
    });
    return cart ?? { lines: [] };
  }
  async reorder(actor: JwtPayload, id: string) {
    const company = await this.company(actor, true);
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId: company.id },
      include: { items: true },
    });
    if (!order) invalid('purchase order not found');
    const lines = order.items.map((i) => ({
      sku: i.sku,
      quantity: i.quantity,
    }));
    const preview = await this.dealer.validateQuickOrder(lines, actor);
    if (preview.valid) await this.cart(actor, lines);
    return preview;
  }
  async ship(actor: JwtPayload, id: string, dto: PoShipmentDto) {
    if (
      !dto.lines.length ||
      new Set(dto.lines.map((l) => l.sku)).size !== dto.lines.length
    )
      invalid('shipment needs unique SKU lines');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;
      const existing = await tx.purchaseOrderShipment.findUnique({
        where: { dedupeKey: dto.dedupeKey },
      });
      if (existing) {
        if (existing.orderId !== id)
          conflict('shipment key belongs to another order');
        if (
          existing.carrier !== dto.carrier ||
          existing.trackingNumber !== dto.trackingNumber ||
          JSON.stringify(existing.lines) !== JSON.stringify(dto.lines)
        )
          conflict('shipment key was reused with different content');
        return existing;
      }
      const order = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order || !['CONFIRMED', 'PROCESSING'].includes(order.status))
        conflict('only confirmed or processing orders can ship');
      if (
        await tx.purchaseOrderRefund.count({
          where: {
            orderId: id,
            cancelOrder: true,
            status: { in: ['REQUESTED', 'PENDING', 'AWAITING_OFFLINE'] },
          },
        })
      )
        conflict('order has a cancellation refund awaiting resolution');
      for (const line of [...dto.lines].sort((a, b) =>
        (
          order.items.find((item) => item.sku === a.sku)?.variantId ?? a.sku
        ).localeCompare(
          order.items.find((item) => item.sku === b.sku)?.variantId ?? b.sku,
        ),
      )) {
        const item = order.items.find((i) => i.sku === line.sku);
        if (!item || line.quantity > item.quantity - item.shippedQuantity)
          invalid(`shipment exceeds remaining quantity for ${line.sku}`);
        await this.inventory.ship(
          tx,
          item.variantId,
          line.quantity,
          order.market,
        );
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { shippedQuantity: { increment: line.quantity } },
        });
      }
      const shipment = await tx.purchaseOrderShipment.create({
        data: {
          orderId: id,
          carrier: dto.carrier,
          trackingNumber: dto.trackingNumber,
          dedupeKey: dto.dedupeKey,
          lines: JSON.parse(JSON.stringify(dto.lines)),
        },
      });
      const complete = order.items.every(
        (i) =>
          i.shippedQuantity +
            (dto.lines.find((l) => l.sku === i.sku)?.quantity ?? 0) ===
          i.quantity,
      );
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: complete ? 'SHIPPED' : 'PROCESSING' },
      });
      await this.audit(tx, actor, 'dealer.po.shipment', id, {
        shipmentId: shipment.id,
        complete,
      });
      return shipment;
    });
    await this.notifyOrder(id, 'shipment', result.id);
    return result;
  }

  async notifyOrder(id: string, event: string, eventId?: string) {
    if (!this.notifications) return;
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { createdBy: { select: { email: true } } },
    });
    if (!order) return;
    const link = `${process.env.APP_BASE_URL ?? process.env.WEB_URL ?? 'http://localhost:3000'}/dealer/procurement`;
    await this.notifications.enqueue({
      kind: `dealer.order.${event}`,
      to: order.createdBy.email,
      subject: `Purchase order ${order.orderNo} update`,
      text: `Purchase order ${order.orderNo}: ${order.status}. Payment: ${order.paymentStatus}. ${link}`,
      variables: {
        reference: order.orderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        link,
      },
      dedupeKey: `dealer.po:${event}:${id}:${eventId ?? order.updatedAt.toISOString()}`,
    });
  }
  async document(actor: JwtPayload, id: string, kind: string) {
    if (!['confirmation', 'quote', 'invoice', 'packing-list'].includes(kind))
      invalid('unsupported document type');
    const company =
      actor.kind === 'customer' ? await this.company(actor) : null;
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, ...(company ? { companyId: company.id } : {}) },
      include: { items: true, shipments: true },
    });
    if (!order)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'order not found', 404);
    const bytes = await purchaseOrderPdf(order, kind);
    return {
      fileName: `${kind}-${order.orderNo}.pdf`,
      base64: bytes.toString('base64'),
      mimeType: 'application/pdf',
    };
  }
  private async notify(id: string, event: string) {
    if (!this.notifications) return;
    if (['quoted', 'accepted', 'rejected'].includes(event))
      await this.prisma.notificationOutbox.updateMany({
        where: {
          kind: 'dealer.rfq.expiring',
          dedupeKey: { startsWith: `rfq:${id}:expires:` },
          status: 'PENDING',
        },
        data: { status: 'CANCELLED', payload: '' },
      });
    const rfq = await this.prisma.dealerRfq.findUnique({
      where: { id },
      include: {
        createdBy: { select: { email: true } },
        quotes: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!rfq) return;
    const base = (
      process.env.APP_BASE_URL ??
      process.env.WEB_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    await this.notifications.enqueue({
      kind: `dealer.rfq.${event}`,
      to: rfq.createdBy.email,
      subject: `RFQ ${rfq.title}: ${event}`,
      text: `Your RFQ ${id} was ${event}. Review details: ${base}/dealer/procurement`,
      dedupeKey: `rfq:${id}:${event}:${rfq.revision}`,
    });
    if (event === 'submitted' && process.env.B2B_SALES_EMAIL)
      await this.notifications.enqueue({
        kind: 'dealer.rfq.sales',
        to: process.env.B2B_SALES_EMAIL,
        subject: `New RFQ: ${rfq.title}`,
        text: `Review ${id}: ${base}/admin/b2b`,
        dedupeKey: `rfq:${id}:sales`,
      });
    if (event === 'quoted' && rfq.quotes[0])
      await this.notifications.enqueue({
        kind: 'dealer.rfq.expiring',
        to: rfq.createdBy.email,
        subject: `Quote reminder: ${rfq.title}`,
        text: `Quote version ${rfq.revision} expires ${rfq.quotes[0].validUntil.toISOString()}. Check the current status before accepting: ${base}/dealer/procurement`,
        dedupeKey: `rfq:${id}:expires:${rfq.revision}`,
        availableAt: new Date(
          Math.max(Date.now(), rfq.quotes[0].validUntil.getTime() - 86400000),
        ),
      });
  }
  private audit(
    tx: Prisma.TransactionClient,
    actor: JwtPayload,
    action: string,
    entityId: string,
    after: Prisma.InputJsonObject,
  ) {
    return tx.auditLog.create({
      data: {
        actorKind: actor.kind === 'staff' ? 'STAFF' : 'CUSTOMER',
        ...(actor.kind === 'staff'
          ? { actorStaffId: actor.sub }
          : { actorCustomerId: actor.sub }),
        action,
        entityType: action.startsWith('dealer.po')
          ? 'purchaseOrder'
          : action.startsWith('dealer.pricebook')
            ? 'dealerPriceBook'
            : 'dealerRfq',
        entityId,
        after,
      },
    });
  }
}

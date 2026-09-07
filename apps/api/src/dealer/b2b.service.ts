import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { DealerService } from './dealer.service.js';
import type {
  AcceptQuoteDto,
  CreateQuoteDto,
  CreateRfqDto,
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
      member.company.status !== 'APPROVED' ||
      member.user.status !== 'ACTIVE' ||
      (write && member.role === 'VIEWER')
    )
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'current company membership does not permit this operation',
        403,
      );
    return { ...member.company, role: member.role };
  }

  async createRfq(actor: JwtPayload, dto: CreateRfqDto) {
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
          company: { select: { id: true, companyName: true } },
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
    return this.prisma.$transaction(async (tx) => {
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
  }
  async quote(actor: JwtPayload, id: string, dto: CreateQuoteDto) {
    return this.prisma.$transaction(async (tx) => {
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
      const totalCents = checkedTotal([
        subtotalCents,
        dto.taxCents,
        dto.shippingCents,
      ]);
      await tx.dealerQuote.create({
        data: {
          rfqId: id,
          version: rfq.revision + 1,
          items,
          subtotalCents,
          taxCents: dto.taxCents,
          shippingCents: dto.shippingCents,
          totalCents,
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
  }
  async rejectQuote(actor: JwtPayload, id: string, version: number) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.company(actor, true, tx);
      const rfq = await this.lockedRfq(tx, id, company.id);
      if (
        this.effectiveRfq(rfq).status !== 'QUOTED' ||
        rfq.revision !== version
      )
        conflict('only the latest valid quote can be rejected');
      const updated = await tx.dealerRfq.update({
        where: { id },
        data: { status: 'REJECTED' },
        include: details,
      });
      await this.audit(tx, actor, 'dealer.rfq.reject', id, { version });
      return updated;
    });
  }
  async acceptQuote(actor: JwtPayload, id: string, dto: AcceptQuoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.company(actor, true, tx);
      const rfq = await this.lockedRfq(tx, id, company.id);
      // Retry after a lost response returns the original PO without reserving stock again.
      if (rfq.purchaseOrder) {
        if (rfq.purchaseOrder.quoteVersion !== dto.version)
          conflict('quote version differs from the accepted order');
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
      const items = quote.items as unknown as ItemSnapshot[];
      // Consistent SKU lock order prevents opposing multi-line purchases deadlocking.
      for (const item of [...items].sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      )) {
        const updated = await tx.stock.updateMany({
          where: {
            variantId: item.variantId,
            available: { gte: item.quantity },
            variant: { status: true, product: { status: 'ACTIVE' } },
          },
          data: {
            available: { decrement: item.quantity },
            reserved: { increment: item.quantity },
          },
        });
        if (updated.count !== 1)
          conflict(`SKU ${item.sku} is unavailable or has insufficient stock`);
      }
      const order = await tx.purchaseOrder.create({
        data: {
          orderNo: `PO-${randomUUID().toUpperCase()}`,
          companyId: company.id,
          companyName: company.companyName,
          createdById: actor.sub,
          rfqId: id,
          quoteVersion: quote.version,
          shippingAddress: { ...dto.shippingAddress },
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
      await this.audit(tx, actor, 'dealer.rfq.accept', id, {
        orderId: order.id,
        version: quote.version,
        totalCents: order.totalCents,
      });
      return order;
    });
  }
  async listOrders(actor?: JwtPayload) {
    const company = actor ? await this.company(actor) : null;
    return this.prisma.purchaseOrder.findMany({
      where: company ? { companyId: company.id } : {},
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async transitionOrder(
    actor: JwtPayload,
    id: string,
    next: PurchaseOrderStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
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
      assertPoTransition(order.status, next);
      if (next === 'CANCELLED' || next === 'SHIPPED') {
        for (const item of [...order.items].sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        )) {
          const updated = await tx.stock.updateMany({
            where: {
              variantId: item.variantId,
              reserved: { gte: item.quantity },
            },
            data: {
              reserved: { decrement: item.quantity },
              ...(next === 'CANCELLED'
                ? { available: { increment: item.quantity } }
                : {}),
            },
          });
          if (updated.count !== 1)
            conflict(`stock reservation mismatch for ${item.sku}`);
        }
      }
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: next },
        include: { items: true },
      });
      await this.audit(tx, actor, 'dealer.po.transition', id, {
        before: order.status,
        status: next,
      });
      return updated;
    });
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

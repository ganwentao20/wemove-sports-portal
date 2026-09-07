import { B2bAfterSalesService } from './b2b-after-sales.service.js';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { B2bService } from './b2b.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { PaymentEventDto } from '../order/commerce.dto.js';
import type { OfflinePoPaymentDto } from './dto/portal.dto.js';
import {
  paymentCanonical,
  verifyPaymentSignature,
} from '../order/commerce-rules.js';
function fail(message: string, status = 409): never {
  throw new BizException(ERROR_CODES.CONFLICT, message, status);
}
@Injectable()
export class B2bPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly b2b: B2bService,
    private readonly afterSales: B2bAfterSalesService,
  ) {}
  private mode() {
    const mode = process.env.B2B_PAYMENT_MODE ?? 'WEBHOOK';
    if (
      mode === 'DEMO' &&
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_DEMO_PAYMENTS !== 'true'
    )
      fail('demo payment is disabled in production', 503);
    if (
      mode !== 'DEMO' &&
      (!process.env.B2B_PAYMENT_CREATE_URL ||
        !process.env.B2B_PAYMENT_WEBHOOK_SECRET)
    )
      fail('B2B card provider is not configured; contact sales', 503);
    return mode;
  }
  async session(actor: JwtPayload, id: string, key: string) {
    const company = await this.b2b.company(actor, true);
    const mode = this.mode();
    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id"=${id} AND "companyId"=${company.id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findFirst({
        where: { id, companyId: company.id },
        include: { payments: true },
      });
      if (
        !order ||
        order.status !== 'PENDING_REVIEW' ||
        order.paymentMethod !== 'CARD' ||
        !['UNPAID', 'FAILED'].includes(order.paymentStatus)
      )
        fail('order is not awaiting card payment');
      const duplicate = await tx.purchaseOrderPayment.findUnique({
        where: { idempotencyKey: key },
      });
      if (duplicate) {
        if (duplicate.orderId !== id)
          fail('idempotency key belongs to another order');
        return duplicate;
      }
      const pending = order.payments.find((p) => p.status === 'PENDING');
      if (pending) return pending;
      return tx.purchaseOrderPayment.create({
        data: {
          orderId: id,
          idempotencyKey: key,
          amountCents: order.totalCents,
          currency: order.currency,
          mode,
        },
      });
    });
    if (
      payment.mode === 'DEMO' ||
      payment.checkoutUrl ||
      payment.status !== 'PENDING'
    )
      return payment;
    const response = await fetch(process.env.B2B_PAYMENT_CREATE_URL!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': payment.id,
        ...(process.env.B2B_PAYMENT_API_TOKEN
          ? { authorization: `Bearer ${process.env.B2B_PAYMENT_API_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        paymentId: payment.id,
        orderId: id,
        amountCents: payment.amountCents,
        currency: payment.currency,
        returnUrl: `${process.env.APP_BASE_URL ?? process.env.WEB_URL ?? 'http://localhost:3000'}/dealer/procurement`,
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!response?.ok)
      fail('payment provider unavailable; retry uses the same session', 503);
    const result = (await response.json()) as {
      checkoutUrl?: string;
      providerReference?: string;
    };
    if (!result.checkoutUrl || !result.checkoutUrl.startsWith('https://'))
      fail('provider returned an invalid checkout URL', 502);
    return this.prisma.purchaseOrderPayment.update({
      where: { id: payment.id },
      data: {
        checkoutUrl: result.checkoutUrl,
        providerReference: result.providerReference,
      },
    });
  }
  async webhook(dto: PaymentEventDto, timestamp: string, signature: string) {
    if (!process.env.B2B_PAYMENT_WEBHOOK_SECRET)
      fail('webhook not configured', 503);
    verifyPaymentSignature(
      dto,
      timestamp,
      signature,
      process.env.B2B_PAYMENT_WEBHOOK_SECRET,
    );
    return this.apply(dto, 'WEBHOOK');
  }
  async offline(actor: JwtPayload, id: string, dto: OfflinePoPaymentDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id"=${id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findUnique({ where: { id } });
      if (
        !order ||
        order.paymentMethod === 'CARD' ||
        order.status === 'CANCELLED'
      )
        fail('order is not eligible for offline payment confirmation');
      const prior = await tx.purchaseOrderPayment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (prior) {
        if (
          prior.orderId !== id ||
          prior.amountCents !== dto.amountCents ||
          prior.providerReference !== dto.providerReference
        )
          fail('payment key reused with different details');
        return prior;
      }
      if (
        !['UNPAID', 'FAILED'].includes(order.paymentStatus) ||
        dto.amountCents !== order.totalCents
      )
        fail('confirm the exact outstanding order balance');
      const payment = await tx.purchaseOrderPayment.create({
        data: {
          orderId: id,
          idempotencyKey: dto.idempotencyKey,
          amountCents: dto.amountCents,
          currency: order.currency,
          providerReference: dto.providerReference,
          mode: 'OFFLINE',
          status: 'SUCCEEDED',
        },
      });
      await tx.purchaseOrder.update({
        where: { id },
        data: { paymentStatus: 'PAID' },
      });
      await tx.auditLog.create({
        data: {
          actorKind: 'STAFF',
          actorStaffId: actor.sub,
          action: 'dealer.po.payment.confirm',
          entityType: 'purchaseOrder',
          entityId: id,
          after: {
            paymentId: payment.id,
            amountCents: dto.amountCents,
            providerReference: dto.providerReference,
          },
        },
      });
      return payment;
    });
    await this.b2b.notifyOrder(id, 'payment', result.id);
    return result;
  }
  async demo(actor: JwtPayload, id: string, status: string) {
    this.mode();
    const c = await this.b2b.company(actor, true);
    const payment = await this.prisma.purchaseOrderPayment.findFirst({
      where: { id, mode: 'DEMO', order: { companyId: c.id } },
    });
    if (!payment) fail('demo payment not found', 404);
    return this.apply(
      {
        eventId: `demo:${id}:${status}`,
        paymentId: id,
        status: status as PaymentEventDto['status'],
        amountCents: payment.amountCents,
        currency: payment.currency,
        providerReference: `DEMO-${id}`,
      },
      'DEMO',
    );
  }
  private async apply(dto: PaymentEventDto, mode: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.purchaseOrderPayment.findUnique({
        where: { id: dto.paymentId },
      });
      if (!payment || payment.mode !== mode)
        fail('payment session not found', 404);
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id"=${payment.orderId} FOR UPDATE`;
      const payloadHash = createHash('sha256')
        .update(paymentCanonical(dto))
        .digest('hex');
      const seen = await tx.purchaseOrderPaymentEvent.findUnique({
        where: { eventId: dto.eventId },
      });
      if (seen) {
        if (seen.payloadHash !== payloadHash)
          fail('event ID reused with different payload');
        return { accepted: true, duplicate: true };
      }
      const current = await tx.purchaseOrderPayment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      if (current.status === 'SUCCEEDED' && dto.status === 'SUCCEEDED') {
        if (
          current.amountCents !== dto.amountCents ||
          current.currency !== dto.currency
        )
          fail('terminal payment details conflict');
        return { accepted: true, duplicate: true };
      }
      if (current.status !== 'PENDING' && current.status !== dto.status)
        fail('payment is already terminal');
      if (
        payment.amountCents !== dto.amountCents ||
        payment.currency !== dto.currency
      )
        fail('payment amount or currency mismatch');
      const order = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: payment.orderId },
      });
      const cancelledPayment =
        dto.status === 'SUCCEEDED' && order.status === 'CANCELLED';
      await tx.purchaseOrderPaymentEvent.create({
        data: {
          eventId: dto.eventId,
          paymentId: payment.id,
          payloadHash,
          status: dto.status,
        },
      });
      await tx.purchaseOrderPayment.update({
        where: { id: payment.id },
        data: { status: dto.status, providerReference: dto.providerReference },
      });
      await tx.purchaseOrder.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: dto.status === 'SUCCEEDED' ? 'PAID' : dto.status,
        },
      });
      if (cancelledPayment) {
        const refund = await tx.purchaseOrderRefund.upsert({
          where: { idempotencyKey: 'late-po-payment:' + payment.id },
          create: {
            orderId: order.id,
            paymentId: payment.id,
            requestedById: order.createdById,
            idempotencyKey: 'late-po-payment:' + payment.id,
            amountCents: payment.amountCents,
            currency: payment.currency,
            reason: 'Automatic refund for payment received after cancellation',
            status: 'PENDING',
          },
          update: {},
        });
        return { accepted: true, duplicate: false, refundId: refund.id };
      }
      return { accepted: true, duplicate: false };
    });
    if (!result.duplicate) {
      const payment = await this.prisma.purchaseOrderPayment.findUnique({
        where: { id: dto.paymentId },
      });
      if (payment)
        await this.b2b.notifyOrder(payment.orderId, 'payment', dto.eventId);
    }
    if ('refundId' in result && typeof result.refundId === 'string')
      await this.afterSales.deliverRefund(result.refundId);
    return result;
  }
}

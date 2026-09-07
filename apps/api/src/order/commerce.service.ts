import { ReturnEvidenceService } from './return-evidence.service.js';
import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  Logger,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { resolveRetailPrice } from '../pricing/pricing-engine.js';
import type {
  CheckoutDto,
  CouponDto,
  MarketDto,
  PaymentEventDto,
  RefundDto,
  ReturnDecisionDto,
  ReturnDto,
  ShipmentDto,
  ManualOrderDto,
  MarketInventoryDto,
} from './commerce.dto.js';
import {
  calculateTotals,
  commerceError,
  isPublicProduct,
  money,
  paymentCanonical,
  validateLines,
  verifyPaymentSignature,
} from './commerce-rules.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  InventoryService,
  inventoryAvailability,
} from './inventory.service.js';
import { TaxShippingService } from './tax-shipping.service.js';

export const DEFAULT_MARKET = {
  code: 'US',
  label: 'United States',
  currency: 'USD',
  retailEnabled: true,
  countries: ['US'],
  taxBps: 0,
  shippingCents: 0,
  expressCents: 1500,
  freeShippingAboveCents: null,
  reservationMinutes: 30,
  paymentMode: 'DEMO',
  inventoryDisplay: 'STATUS',
  allowPreorder: false,
  allowBackorder: false,
  defaultSort: 'featured',
  shippingRules: [],
  taxRegionRates: {},
  taxMode: 'CONFIGURED',
  shippingMode: 'CONFIGURED',
};
const orderInclude = {
  items: { include: { variant: { select: { productId: true } } } },
  payments: true,
  shipments: true,
  returns: true,
  refunds: true,
} as const;

@Injectable()
export class CommerceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommerceService.name);
  private timer?: ReturnType<typeof setInterval>;
  private processing = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly notifications?: NotificationsService,
    private readonly inventory: InventoryService = new InventoryService(),
    private readonly delivery: TaxShippingService = new TaxShippingService(),
    @Optional() private readonly evidence?: ReturnEvidenceService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      if (this.processing) return;
      this.processing = true;
      void Promise.allSettled([
        this.expire(),
        this.retryPendingRefunds(),
        this.deliverInventoryAlerts(),
      ])
        .then((results) => {
          if (results.some((result) => result.status === 'rejected'))
            this.logger.warn(
              'Commerce background processing failed; will retry',
            );
        })
        .finally(() => {
          this.processing = false;
        });
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async markets() {
    const rows = await this.prisma.retailMarket.findMany({
      orderBy: { code: 'asc' },
    });
    return rows.length ? rows : [DEFAULT_MARKET];
  }
  async market(code = 'US', tx: Prisma.TransactionClient = this.prisma) {
    const found = await tx.retailMarket.findUnique({ where: { code } });
    if (found) return found;
    if (code === 'US') return DEFAULT_MARKET;
    return commerceError('market is not configured');
  }
  async saveMarket(dto: MarketDto, actor: JwtPayload) {
    for (const [region, rate] of Object.entries(dto.taxRegionRates ?? {}))
      if (
        !/^[A-Z0-9 -]{1,80}$/.test(region) ||
        !Number.isInteger(rate) ||
        rate < 0 ||
        rate > 10000
      )
        commerceError(
          'Regional tax rates require uppercase region keys and basis points 0–10000',
        );
    for (const rule of dto.shippingRules ?? [])
      if (
        (rule.maxWeightGrams !== undefined &&
          rule.maxWeightGrams <= (rule.minWeightGrams ?? 0)) ||
        (rule.maxSubtotalCents !== undefined &&
          rule.maxSubtotalCents <= (rule.minSubtotalCents ?? 0))
      )
        commerceError(
          'Shipping interval upper bounds must exceed lower bounds',
        );
    for (const mode of ['TAX', 'SHIPPING'])
      if (
        (mode === 'TAX' ? dto.taxMode : dto.shippingMode) === 'HTTP' &&
        (!process.env[`${mode}_PROVIDER_URL`]?.startsWith('https://') ||
          !process.env[`${mode}_PROVIDER_KEY`])
      )
        commerceError(`${mode} provider HTTPS endpoint/key is required`);
    if (
      dto.paymentMode === 'WEBHOOK' &&
      (!process.env.PAYMENT_WEBHOOK_SECRET ||
        !process.env.PAYMENT_PROVIDER_URL ||
        !process.env.PAYMENT_PROVIDER_KEY)
    )
      commerceError(
        'payment provider URL/key and webhook secret must be configured before enabling provider payments',
      );
    const row = await this.prisma.retailMarket.upsert({
      where: { code: dto.code },
      create: {
        ...dto,
        shippingRules: dto.shippingRules as unknown as
          Prisma.InputJsonValue | undefined,
      },
      update: {
        ...dto,
        shippingRules: dto.shippingRules as unknown as
          Prisma.InputJsonValue | undefined,
      },
    });
    this.record(actor, 'commerce.market.update', dto.code, dto);
    return row;
  }
  coupons() {
    return this.prisma.retailCoupon.findMany({ orderBy: { code: 'asc' } });
  }
  async saveInventory(
    actor: JwtPayload,
    variantId: string,
    dto: MarketInventoryDto,
  ) {
    if (dto.syncError && dto.available !== undefined)
      commerceError('Failed source sync must preserve previous quantities');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "variantId" FROM "Stock" WHERE "variantId"=${variantId} FOR UPDATE`;
      const stock = await tx.stock.findUniqueOrThrow({ where: { variantId } });
      const existing = await tx.marketInventory.findUnique({
        where: { variantId_market: { variantId, market: dto.market } },
      });
      if (!existing && stock.reserved > 0)
        commerceError(
          'Create market allocations after existing global reservations are released or shipped',
        );
      await this.market(dto.market, tx);
      return tx.marketInventory.upsert({
        where: { variantId_market: { variantId, market: dto.market } },
        create: {
          variantId,
          ...dto,
          syncError: dto.syncError || null,
          sourceUpdatedAt: dto.available !== undefined ? new Date() : null,
        },
        update: {
          available: dto.available,
          lowThreshold: dto.lowThreshold,
          source: dto.source,
          ...(dto.syncError !== undefined
            ? { syncError: dto.syncError || null }
            : dto.available !== undefined
              ? { syncError: null }
              : {}),
          ...(dto.available !== undefined
            ? { sourceUpdatedAt: new Date() }
            : {}),
        },
      });
    });
    this.record(actor, 'inventory.market.update', variantId, result);
    return result;
  }
  customers(search = '') {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true },
      take: 100,
    });
  }
  manualCatalog() {
    return this.prisma.productVariant.findMany({
      where: {
        status: true,
        product: { status: { in: ['ACTIVE', 'SCHEDULED'] } },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        msrpCents: true,
        salePriceCents: true,
      },
      take: 500,
      orderBy: { sku: 'asc' },
    });
  }
  async saveCoupon(dto: CouponDto, actor: JwtPayload) {
    const previous = await this.prisma.retailCoupon.findUnique({
      where: { code: dto.code },
    });
    const start =
        dto.startsAt === undefined ? previous?.startsAt : dto.startsAt,
      end = dto.endsAt === undefined ? previous?.endsAt : dto.endsAt;
    if (start && end && new Date(start) >= new Date(end))
      commerceError('coupon end must follow start');
    const data = {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
    };
    const row = await this.prisma.retailCoupon.upsert({
      where: { code: dto.code },
      create: data,
      update: {
        ...dto,
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.endsAt !== undefined
          ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }
          : {}),
      },
    });
    this.record(actor, 'commerce.coupon.update', dto.code, dto);
    return row;
  }
  private customer(actor: JwtPayload) {
    if (actor.kind !== 'customer')
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'customer account required',
        403,
      );
  }
  private async quoteTx(
    tx: Prisma.TransactionClient,
    actor: JwtPayload,
    dto: CheckoutDto,
    manual?: Array<{ variantId: string; quantity: number }>,
  ) {
    this.customer(actor);
    const market = await this.market(dto.market, tx);
    if (!market.retailEnabled)
      commerceError(
        'Retail checkout is closed in this market. Use Where to Buy or Contact.',
      );
    if (
      !dto.shippingAddress?.recipient ||
      !dto.shippingAddress.line1 ||
      !dto.shippingAddress.city ||
      !dto.shippingAddress.postalCode ||
      !market.countries.includes(dto.shippingAddress.country)
    )
      commerceError(
        'a complete shipping address in the selected market is required',
      );
    const manualVariants = manual
      ? await tx.productVariant.findMany({
          where: { id: { in: manual.map((i) => i.variantId) } },
          include: { product: true, stock: true, marketInventory: true },
        })
      : [];
    if (
      manual &&
      (new Set(manual.map((i) => i.variantId)).size !== manual.length ||
        manualVariants.length !== manual.length)
    )
      commerceError('manual order variant IDs must be valid and distinct');
    const cart = manual
      ? {
          id: 'manual',
          items: manual.map((i) => ({
            ...i,
            unitPriceCents: 0,
            variant: manualVariants.find((v) => v.id === i.variantId)!,
          })),
        }
      : await tx.cart.findUnique({
          where: { userId: actor.sub },
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                    stock: true,
                    marketInventory: true,
                  },
                },
              },
            },
          },
        });
    if (!cart?.items.length) commerceError('cart is empty');
    const lines = cart.items.map((item) => {
      const v = item.variant;
      if (v.stock?.syncError)
        commerceError(
          `SKU ${v.sku} availability is awaiting inventory synchronization`,
        );
      if (!v.status || !isPublicProduct(v.product, market.code))
        commerceError(`SKU ${v.sku} is not available in this market`);
      if (item.quantity > inventoryAvailability(v, market).capacity)
        commerceError(`insufficient stock for SKU ${v.sku}`);
      const priceMap = v.marketPrices as Record<
        string,
        {
          msrpCents?: number;
          salePriceCents?: number;
          currency?: string;
          startsAt?: string;
          endsAt?: string;
        }
      >;
      const marketPrice = priceMap?.[market.code];
      if (
        (market.currency !== 'USD' &&
          (!marketPrice || marketPrice.currency !== market.currency)) ||
        (marketPrice?.currency && marketPrice.currency !== market.currency)
      )
        commerceError(`SKU ${v.sku} has no price in ${market.currency}`);
      const now = new Date();
      if (
        marketPrice &&
        ((marketPrice.startsAt && new Date(marketPrice.startsAt) > now) ||
          (marketPrice.endsAt && new Date(marketPrice.endsAt) <= now))
      )
        commerceError(
          `SKU ${v.sku} market price is outside its validity window`,
        );
      const price = resolveRetailPrice(marketPrice ?? v);
      if (!price) commerceError(`SKU ${v.sku} has no retail price`);
      return {
        variantId: v.id,
        productName: v.product.name,
        sku: v.sku,
        variantName: v.name,
        quantity: item.quantity,
        unitPriceCents: money(price.priceCents),
        priceSource: price.source,
        weightGrams: v.weightGrams ?? 0,
        lineCents: money(price.priceCents * item.quantity),
        previousUnitPriceCents: item.unitPriceCents,
      };
    });
    const subtotal = money(
      lines.reduce((sum, line) => sum + line.lineCents, 0),
    );
    const code = dto.couponCode?.trim().toUpperCase();
    const coupon = code
      ? await tx.retailCoupon.findUnique({ where: { code } })
      : null;
    const now = new Date();
    if (
      code &&
      (!coupon ||
        !coupon.active ||
        coupon.market !== market.code ||
        coupon.minimumCents > subtotal ||
        (coupon.startsAt && coupon.startsAt > now) ||
        (coupon.endsAt && coupon.endsAt <= now) ||
        (coupon.maxUses !== null && coupon.uses >= coupon.maxUses))
    )
      commerceError('coupon is invalid, expired, exhausted or does not apply');
    if (coupon?.userIds.length && !coupon.userIds.includes(actor.sub))
      commerceError('coupon does not apply to this customer');
    if (
      coupon?.perUserLimit &&
      (await tx.order.count({
        where: {
          userId: actor.sub,
          couponCode: coupon.code,
          status: { not: 'CANCELLED' },
        },
      })) >= coupon.perUserLimit
    )
      commerceError('customer coupon redemption limit reached');
    const eligibleCents = coupon?.productIds.length
      ? cart.items
          .filter((i) => coupon.productIds.includes(i.variant.productId))
          .reduce(
            (sum, i) =>
              sum +
              (lines.find((l) => l.variantId === i.variantId)?.lineCents ?? 0),
            0,
          )
      : subtotal;
    if (coupon && eligibleCents === 0)
      commerceError('coupon does not apply to any cart products');
    const baseTotals = calculateTotals(
      subtotal,
      market,
      coupon ? { ...coupon, eligibleCents } : null,
      dto.shippingMethod,
    );
    const delivery = await this.delivery.calculate(
      market,
      dto.shippingAddress,
      dto.shippingMethod,
      subtotal - baseTotals.discountCents,
      lines.reduce((sum, line) => sum + line.weightGrams * line.quantity, 0),
      coupon?.freeShipping ?? false,
    );
    return { cart, market, coupon, lines, ...baseTotals, ...delivery };
  }
  async quote(actor: JwtPayload, dto: CheckoutDto) {
    const q = await this.quoteTx(this.prisma, actor, dto);
    const { cart: _cart, coupon, market, ...quote } = q;
    return {
      ...quote,
      currency: market.currency,
      market: market.code,
      paymentMode: market.paymentMode,
      couponCode: coupon?.code ?? null,
    };
  }
  async checkout(
    actor: JwtPayload,
    dto: CheckoutDto,
    manual?: Array<{ variantId: string; quantity: number }>,
  ) {
    const order = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${actor.sub} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "userId"=${actor.sub} FOR UPDATE`;
        const q = await this.quoteTx(tx, actor, dto, manual);
        if (q.coupon) {
          const changed = await tx.retailCoupon.updateMany({
            where: { code: q.coupon.code, uses: q.coupon.uses },
            data: { uses: { increment: 1 } },
          });
          if (!changed.count) commerceError('coupon changed; refresh checkout');
        }
        for (const line of [...q.lines].sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        )) {
          await this.inventory.reserve(
            tx,
            line.variantId,
            line.quantity,
            q.market.code,
          );
        }
        const created = await tx.order.create({
          data: {
            orderNo: `WM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            userId: actor.sub,
            subtotalCents: q.subtotalCents,
            discountCents: q.discountCents,
            shippingCents: q.shippingCents,
            taxCents: q.taxCents,
            totalCents: q.totalCents,
            currency: q.market.currency,
            market: q.market.code,
            calculationSnapshot: q.calculationSnapshot as Prisma.InputJsonValue,
            couponCode: q.coupon?.code,
            shippingMethod: dto.shippingMethod,
            shippingAddress:
              dto.shippingAddress as unknown as Prisma.InputJsonValue,
            billingAddress: (dto.billingAddress ??
              dto.shippingAddress) as unknown as Prisma.InputJsonValue,
            reservationExpiresAt: new Date(
              Date.now() + q.market.reservationMinutes * 60000,
            ),
            items: {
              create: q.lines.map(({ previousUnitPriceCents, ...line }) => {
                void previousUnitPriceCents;
                return line;
              }),
            },
          },
          include: orderInclude,
        });
        if (!manual)
          await tx.cartItem.deleteMany({ where: { cartId: q.cart.id } });
        return created;
      },
      { timeout: 20000 },
    );
    this.record(actor, 'order.checkout', order.id, {
      totalCents: order.totalCents,
      currency: order.currency,
    });
    return order;
  }
  async manualOrder(actor: JwtPayload, dto: ManualOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user || user.status !== 'ACTIVE')
      commerceError('manual order requires an active customer');
    const order = await this.checkout(
      { sub: user.id, kind: 'customer', email: user.email, name: user.name },
      dto,
      dto.items,
    );
    this.record(actor, 'order.manual.create', order.id, {
      reason: dto.reason,
      userId: user.id,
    });
    return order;
  }
  async order(
    actor: JwtPayload,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const order = await tx.order.findFirst({
      where: { id, ...(actor.kind === 'staff' ? {} : { userId: actor.sub }) },
      include: orderInclude,
    });
    if (!order)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'order not found', 404);
    const history =
      tx === this.prisma
        ? await this.prisma.auditLog.findMany({
            where: { entityId: id, action: { startsWith: 'order.' } },
            orderBy: { createdAt: 'asc' },
            take: 100,
            select: { action: true, after: true, createdAt: true },
          })
        : [];
    return {
      ...order,
      history: history.map((entry) => ({
        action: entry.action,
        createdAt: entry.createdAt,
        ...(typeof (entry.after as Record<string, unknown>)?.reason === 'string'
          ? { reason: String((entry.after as Record<string, unknown>).reason) }
          : {}),
      })),
    };
  }
  async paymentSession(actor: JwtPayload, id: string, key: string) {
    this.customer(actor);
    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const order = await this.order(actor, id, tx);
      if (order.status !== 'PENDING' || order.paymentStatus === 'PAID')
        commerceError('order is not awaiting payment');
      if (
        order.reservationExpiresAt &&
        order.reservationExpiresAt <= new Date()
      )
        commerceError('order reservation expired');
      const existing = await tx.retailPayment.findUnique({
        where: { idempotencyKey: key },
      });
      if (existing) {
        if (existing.orderId !== id)
          commerceError('idempotency key belongs to another order');
        return existing;
      }
      const pending = order.payments.find((p) => p.status === 'PENDING');
      if (pending) return pending;
      const market = await this.market(order.market, tx);
      if (
        market.paymentMode === 'DEMO' &&
        process.env.NODE_ENV === 'production' &&
        process.env.ALLOW_DEMO_PAYMENTS !== 'true'
      )
        commerceError('demo payments are disabled in production');
      return tx.retailPayment.create({
        data: {
          orderId: id,
          idempotencyKey: key,
          mode: market.paymentMode,
          amountCents: order.totalCents,
          currency: order.currency,
        },
      });
    });
    if (
      payment.mode === 'WEBHOOK' &&
      !payment.checkoutUrl &&
      payment.status === 'PENDING'
    ) {
      const result = await this.providerRequest('sessions', {
        idempotencyKey: payment.id,
        paymentId: payment.id,
        amountCents: payment.amountCents,
        currency: payment.currency,
        returnUrl: `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/orders/${id}`,
        webhookUrl: process.env.PAYMENT_WEBHOOK_URL,
      });
      if (
        typeof result.checkoutUrl !== 'string' ||
        !result.checkoutUrl.startsWith('https://') ||
        typeof result.reference !== 'string'
      )
        commerceError(
          'payment provider returned an invalid session; retry with the same idempotency key',
        );
      return this.prisma.retailPayment.update({
        where: { id: payment.id },
        data: {
          checkoutUrl: result.checkoutUrl,
          providerReference: result.reference,
        },
      });
    }
    return payment;
  }
  private async providerRequest(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const base = process.env.PAYMENT_PROVIDER_URL;
    const key = process.env.PAYMENT_PROVIDER_KEY;
    let endpoint: URL;
    try {
      endpoint = new URL(base ?? '');
    } catch {
      commerceError('HTTPS payment provider and key are not configured');
    }
    if (
      !key ||
      (endpoint.protocol !== 'https:' &&
        !(
          process.env.NODE_ENV !== 'production' &&
          endpoint.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
        ))
    )
      commerceError('HTTPS payment provider and key are not configured');
    const body = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const signature = createHmac('sha256', key)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    let response: Response;
    try {
      response = await fetch(
        `${endpoint.toString().replace(/\/$/, '')}/${path}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-payment-timestamp': timestamp,
            'x-payment-signature': signature,
            'idempotency-key': String(payload.idempotencyKey),
          },
          body,
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        },
      );
    } catch {
      await this.paymentAlert(
        'PROVIDER_UNAVAILABLE',
        String(payload.paymentId ?? payload.refundId ?? payload.idempotencyKey),
      );
      commerceError(
        'payment provider unavailable; the operation can be retried with its original key',
      );
    }
    if (!response.ok) {
      await this.paymentAlert(
        `PROVIDER_HTTP_${response.status}`,
        String(payload.paymentId ?? payload.refundId ?? payload.idempotencyKey),
      );
      commerceError(
        `payment provider rejected the request (${response.status}); retry with the original key`,
      );
    }
    const result = await response.json().catch(() => null);
    if (!result || typeof result !== 'object')
      commerceError('invalid payment provider response');
    return result as Record<string, unknown>;
  }
  async webhook(event: PaymentEventDto, timestamp: string, signature: string) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) commerceError('payment webhook is not configured');
    verifyPaymentSignature(event, timestamp, signature, secret);
    return this.applyPayment(event, 'WEBHOOK');
  }
  async demoPayment(actor: JwtPayload, paymentId: string, status: string) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_DEMO_PAYMENTS !== 'true'
    )
      commerceError('demo payments are disabled in production');
    const payment = await this.prisma.retailPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) commerceError('payment not found');
    await this.order(actor, payment.orderId);
    if (payment.mode !== 'DEMO') commerceError('payment is not a demo session');
    return this.applyPayment(
      {
        eventId: `demo:${paymentId}:${status}`,
        paymentId,
        status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        providerReference: `DEMO-${paymentId}`,
      },
      'DEMO',
    );
  }
  private async applyPayment(event: PaymentEventDto, mode: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.retailPayment.findUnique({
        where: { id: event.paymentId },
      });
      if (!payment || payment.mode !== mode)
        commerceError('payment session not found');
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${payment.orderId} FOR UPDATE`;
      const hash = createHash('sha256')
        .update(paymentCanonical(event))
        .digest('hex');
      const seen = await tx.retailPaymentEvent.findUnique({
        where: { eventId: event.eventId },
      });
      if (seen) {
        if (seen.payloadHash !== hash)
          commerceError('event ID was reused with different data');
        return { accepted: true, duplicate: true };
      }
      const current = await tx.retailPayment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });
      const lateSuccess =
        mode === 'WEBHOOK' &&
        event.status === 'SUCCEEDED' &&
        (order.status === 'CANCELLED' ||
          (order.status === 'PENDING' &&
            !!order.reservationExpiresAt &&
            order.reservationExpiresAt <= new Date()));
      if (
        current.status !== 'PENDING' &&
        current.status !== event.status &&
        !lateSuccess
      )
        commerceError('payment already reached a different terminal state');
      if (
        payment.amountCents !== event.amountCents ||
        payment.currency !== event.currency
      )
        commerceError('payment amount or currency mismatch');
      if (current.status === event.status) {
        await tx.retailPaymentEvent.create({
          data: {
            eventId: event.eventId,
            paymentId: payment.id,
            status: event.status,
            payloadHash: hash,
          },
        });
        return { accepted: true, duplicate: true };
      }
      if (lateSuccess) {
        if (order.status === 'PENDING') {
          await this.inventory.lock(
            tx,
            order.items.map((i) => i.variantId),
            order.market,
          );
          for (const item of order.items) {
            if (!item.variantId)
              commerceError('late capture reservation has a missing SKU');
            await this.inventory.release(
              tx,
              item.variantId,
              item.quantity,
              order.market,
            );
          }
          if (order.couponCode)
            await tx.retailCoupon.updateMany({
              where: { code: order.couponCode, uses: { gt: 0 } },
              data: { uses: { decrement: 1 } },
            });
        }
        await tx.retailPaymentEvent.create({
          data: {
            eventId: event.eventId,
            paymentId: payment.id,
            status: event.status,
            payloadHash: hash,
          },
        });
        await tx.retailPayment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            providerReference: event.providerReference,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'PAID',
            reservationExpiresAt: null,
          },
        });
        const refund = await tx.retailRefund.upsert({
          where: { idempotencyKey: `late-capture-${payment.id}` },
          create: {
            orderId: order.id,
            idempotencyKey: `late-capture-${payment.id}`,
            amountCents: payment.amountCents,
            reason:
              'Automatic refund: capture arrived after cancellation or inventory expiration',
          },
          update: {},
        });
        return {
          accepted: true,
          duplicate: false,
          compensatingRefundId: refund.id,
        };
      }
      if (
        event.status === 'SUCCEEDED' &&
        (order.status !== 'PENDING' ||
          (order.reservationExpiresAt &&
            order.reservationExpiresAt <= new Date()))
      )
        commerceError('payment cannot confirm an expired/cancelled order');
      await tx.retailPaymentEvent.create({
        data: {
          eventId: event.eventId,
          paymentId: payment.id,
          status: event.status,
          payloadHash: hash,
        },
      });
      await tx.retailPayment.update({
        where: { id: payment.id },
        data: {
          status: event.status,
          providerReference: event.providerReference,
        },
      });
      if (event.status === 'SUCCEEDED')
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            reservationExpiresAt: null,
          },
        });
      else
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: event.status },
        });
      return { accepted: true, duplicate: false };
    });
    if ('compensatingRefundId' in outcome) {
      await this.paymentAlert('LATE_CAPTURE_REFUND', event.paymentId);
      await this.retryPendingRefunds().catch(() =>
        this.logger.warn('Late capture refund queued for retry'),
      );
    }
    const payment = await this.prisma.retailPayment.findUnique({
      where: { id: event.paymentId },
    });
    if (payment)
      void this.notifyOrder(payment.orderId, 'order.payment.update').catch(() =>
        this.logger.warn('Payment notification enqueue failed'),
      );
    return outcome;
  }
  async retryPendingRefunds() {
    if (!process.env.PAYMENT_PROVIDER_URL || !process.env.PAYMENT_PROVIDER_KEY)
      return { processed: 0 };
    const pending = await this.prisma.retailRefund.findMany({
      where: {
        status: 'PENDING',
        order: { payments: { some: { mode: 'WEBHOOK', status: 'SUCCEEDED' } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    let processed = 0;
    for (const refund of pending) {
      try {
        const result = await this.deliverProviderRefund(refund.id);
        if (result.changed && result.refund.status !== 'PENDING') processed++;
      } catch {
        this.logger.warn(
          'Provider refund pending; retry retains the same idempotency key',
        );
      }
    }
    return { processed };
  }

  private async deliverProviderRefund(id: string) {
    const refund = await this.prisma.retailRefund.findUniqueOrThrow({
      where: { id },
      include: {
        order: {
          include: {
            payments: {
              where: { mode: 'WEBHOOK', status: 'SUCCEEDED' },
            },
          },
        },
      },
    });
    const { order, ...storedRefund } = refund;
    if (refund.status !== 'PENDING')
      return { refund: storedRefund, changed: false };
    const latePaymentId = refund.idempotencyKey.startsWith('late-capture-')
      ? refund.idempotencyKey.slice('late-capture-'.length)
      : null;
    const payment = latePaymentId
      ? order.payments.find((item) => item.id === latePaymentId)
      : order.payments.length === 1
        ? order.payments[0]
        : undefined;
    if (
      !payment?.providerReference?.trim() ||
      payment.currency !== order.currency ||
      refund.amountCents > payment.amountCents
    ) {
      await this.paymentAlert('REFUND_PAYMENT_UNCONFIRMED', id);
      commerceError(
        'refund payment cannot be identified; refund remains pending',
      );
    }
    const payload = {
      idempotencyKey: refund.id,
      refundId: refund.id,
      orderId: refund.orderId,
      paymentId: payment.id,
      paymentReference: payment.providerReference,
      amountCents: refund.amountCents,
      currency: order.currency,
      reason: refund.reason,
    };
    let result: Record<string, unknown>;
    try {
      result = await this.providerRequest('refunds', payload);
    } catch (error) {
      await this.paymentAlert('REFUND_UNCONFIRMED', id);
      throw error;
    }
    if (
      result.refundId !== payload.refundId ||
      result.orderId !== payload.orderId ||
      result.paymentId !== payload.paymentId ||
      result.paymentReference !== payload.paymentReference ||
      result.amountCents !== payload.amountCents ||
      result.currency !== payload.currency ||
      typeof result.reference !== 'string' ||
      !result.reference.trim() ||
      result.reference.length > 160 ||
      typeof result.status !== 'string' ||
      !['PENDING', 'SUCCEEDED', 'FAILED'].includes(result.status)
    ) {
      await this.paymentAlert('REFUND_RESPONSE_MISMATCH', id);
      commerceError(
        'unverified refund provider result; refund remains pending and must be retried with the same key',
      );
    }
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${refund.orderId} FOR UPDATE`;
      const updated = await tx.retailRefund.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: String(result.status),
          providerReference: String(result.reference),
        },
      });
      if (updated.count && result.status !== 'PENDING')
        await this.refundBalance(tx, refund.orderId);
      return {
        refund: await tx.retailRefund.findUniqueOrThrow({ where: { id } }),
        changed: updated.count > 0,
      };
    });
    if (outcome.changed && outcome.refund.status !== 'PENDING') {
      await this.notifyOrder(refund.orderId, 'order.refund.external-result');
      if (outcome.refund.status === 'FAILED')
        await this.paymentAlert('REFUND_FAILED', id);
    }
    return outcome;
  }
  async shipment(actor: JwtPayload, id: string, dto: ShipmentDto) {
    validateLines(dto.items);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const order = await this.order(actor, id, tx);
      const prior = await tx.retailShipment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (prior) {
        if (
          prior.orderId !== id ||
          prior.carrier !== dto.carrier ||
          prior.trackingNumber !== dto.trackingNumber ||
          JSON.stringify(
            (
              prior.items as unknown as Array<{
                orderItemId: string;
                quantity: number;
              }>
            )
              .map((i) => [i.orderItemId, i.quantity])
              .sort(),
          ) !==
            JSON.stringify(
              dto.items.map((i) => [i.orderItemId, i.quantity]).sort(),
            )
        )
          commerceError(
            'shipment idempotency key was reused with different data',
          );
        return prior;
      }
      if (order.status !== 'CONFIRMED' || order.paymentStatus !== 'PAID')
        commerceError('only paid confirmed orders can ship');
      await this.inventory.lock(
        tx,
        order.items.map((i) => i.variantId),
        order.market,
      );
      for (const line of dto.items) {
        const item = order.items.find((i) => i.id === line.orderItemId);
        if (
          !item?.variantId ||
          line.quantity > item.quantity - item.shippedQuantity
        )
          commerceError('shipment exceeds unshipped quantity');
        await this.inventory.ship(
          tx,
          item.variantId,
          line.quantity,
          order.market,
        );
        await tx.orderItem.update({
          where: { id: item.id },
          data: { shippedQuantity: { increment: line.quantity } },
        });
      }
      const shipment = await tx.retailShipment.create({
        data: {
          ...dto,
          orderId: id,
          items: dto.items as unknown as Prisma.InputJsonValue,
        },
      });
      const remaining = await tx.orderItem.findMany({ where: { orderId: id } });
      if (remaining.every((i) => i.shippedQuantity === i.quantity))
        await tx.order.update({ where: { id }, data: { status: 'FULFILLED' } });
      return shipment;
    });
    this.record(actor, 'order.shipment.create', id, result);
    return result;
  }
  async requestReturn(actor: JwtPayload, id: string, dto: ReturnDto) {
    this.customer(actor);
    validateLines(dto.items);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const order = await this.order(actor, id, tx);
      for (const line of dto.items) {
        const item = order.items.find((i) => i.id === line.orderItemId);
        const pending = order.returns
          .filter((r) => ['REQUESTED', 'APPROVED'].includes(r.status))
          .flatMap(
            (r) =>
              r.items as unknown as Array<{
                orderItemId: string;
                quantity: number;
              }>,
          )
          .filter((l) => l.orderItemId === line.orderItemId)
          .reduce((n, l) => n + l.quantity, 0);
        if (
          !item ||
          line.quantity > item.shippedQuantity - item.returnedQuantity - pending
        )
          commerceError(
            'return exceeds delivered/shipped quantity or is already requested',
          );
      }
      if (dto.attachments?.length && !this.evidence)
        commerceError('Return evidence service unavailable');
      const attachments =
        (await this.evidence?.validate(
          tx,
          actor,
          id,
          dto.attachments ?? [],
          dto.items.map((line) => line.orderItemId),
        )) ?? [];
      return tx.retailReturn.create({
        data: {
          orderId: id,
          reason: dto.reason,
          description: dto.description?.trim() ?? '',
          attachments,
          resolution: dto.resolution,
          items: dto.items as unknown as Prisma.InputJsonValue,
        },
      });
    });
    this.record(actor, 'order.return.request', id, result);
    return result;
  }
  async returnDecision(
    actor: JwtPayload,
    returnId: string,
    dto: ReturnDecisionDto,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await tx.retailReturn.findUnique({ where: { id: returnId } });
      if (!r) commerceError('return not found');
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${r.orderId} FOR UPDATE`;
      const current = await tx.retailReturn.findUniqueOrThrow({
        where: { id: returnId },
      });
      const inventoryOrder = await tx.order.findUniqueOrThrow({
        where: { id: r.orderId },
        include: { items: true },
      });
      await this.inventory.lock(
        tx,
        inventoryOrder.items.map((i) => i.variantId),
        inventoryOrder.market,
      );
      const transitions: Record<string, string[]> = {
        REQUESTED: ['APPROVED', 'REJECTED'],
        APPROVED: ['RECEIVED'],
        RECEIVED: ['COMPLETED'],
      };
      if (!transitions[current.status]?.includes(dto.status))
        commerceError('invalid return transition');
      if (dto.status === 'COMPLETED') {
        if (current.resolution === 'EXCHANGE')
          commerceError(
            'record the replacement shipment to complete an exchange',
          );
        const refund = await tx.retailRefund.findFirst({
          where: { returnId, status: 'SUCCEEDED' },
        });
        if (!refund)
          commerceError(
            'a successful refund for this return is required before completion',
          );
      }
      if (dto.status === 'RECEIVED')
        for (const line of current.items as unknown as Array<{
          orderItemId: string;
          quantity: number;
        }>) {
          const item = await tx.orderItem.findUniqueOrThrow({
            where: { id: line.orderItemId },
          });
          if (
            !item.variantId ||
            item.returnedQuantity + line.quantity > item.shippedQuantity
          )
            commerceError('return quantity mismatch');
          await tx.orderItem.update({
            where: { id: item.id },
            data: { returnedQuantity: { increment: line.quantity } },
          });
          const order = await tx.order.findUniqueOrThrow({
            where: { id: r.orderId },
          });
          await this.inventory.restock(
            tx,
            item.variantId,
            line.quantity,
            order.market,
          );
        }
      return tx.retailReturn.update({ where: { id: returnId }, data: dto });
    });
    this.record(actor, 'order.return.update', result.orderId, {
      ...dto,
      returnId,
    });
    return result;
  }
  async exchangeShipment(
    actor: JwtPayload,
    returnId: string,
    dto: ShipmentDto,
  ) {
    validateLines(dto.items);
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await tx.retailReturn.findUniqueOrThrow({
        where: { id: returnId },
      });
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${r.orderId} FOR UPDATE`;
      const current = await tx.retailReturn.findUniqueOrThrow({
        where: { id: returnId },
      });
      const prior = await tx.retailShipment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      const inventoryOrder = await tx.order.findUniqueOrThrow({
        where: { id: r.orderId },
        include: { items: true },
      });
      await this.inventory.lock(
        tx,
        inventoryOrder.items.map((i) => i.variantId),
        inventoryOrder.market,
      );
      if (prior) {
        if (prior.orderId !== r.orderId) commerceError('shipment key conflict');
        return prior;
      }
      if (current.resolution !== 'EXCHANGE' || current.status !== 'RECEIVED')
        commerceError(
          'exchange items must be received before replacement shipment',
        );
      const expected = current.items as unknown as Array<{
        orderItemId: string;
        quantity: number;
      }>;
      if (
        dto.items.length !== expected.length ||
        dto.items.some(
          (i) =>
            !expected.some(
              (e) =>
                e.orderItemId === i.orderItemId && e.quantity === i.quantity,
            ),
        )
      )
        commerceError(
          'replacement shipment must match received exchange quantities',
        );
      for (const line of expected) {
        const item = await tx.orderItem.findUniqueOrThrow({
          where: { id: line.orderItemId },
        });
        if (!item.variantId) commerceError('replacement SKU no longer exists');
        const order = await tx.order.findUniqueOrThrow({
          where: { id: r.orderId },
        });
        await this.inventory.reserve(
          tx,
          item.variantId,
          line.quantity,
          order.market,
        );
        await this.inventory.ship(
          tx,
          item.variantId,
          line.quantity,
          order.market,
        );
      }
      const shipment = await tx.retailShipment.create({
        data: {
          ...dto,
          orderId: r.orderId,
          items: dto.items.map((i) => ({
            ...i,
            exchangeReturnId: returnId,
          })) as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.retailReturn.update({
        where: { id: returnId },
        data: {
          status: 'COMPLETED',
          staffNote: `Replacement shipped: ${dto.carrier} ${dto.trackingNumber}`,
        },
      });
      return shipment;
    });
    this.record(actor, 'order.exchange.shipment', result.orderId, result);
    return result;
  }
  async refund(actor: JwtPayload, id: string, dto: RefundDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const order = await this.order(actor, id, tx);
      const previous = await tx.retailRefund.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (previous) {
        if (previous.orderId !== id || previous.amountCents !== dto.amountCents)
          commerceError('refund idempotency key mismatch');
        return previous;
      }
      const used = order.refunds
        .filter((r) => r.status !== 'FAILED')
        .reduce((sum, r) => sum + r.amountCents, 0);
      if (
        !['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus) ||
        used + dto.amountCents > order.totalCents
      )
        commerceError('refund exceeds captured balance');
      if (
        dto.returnId &&
        !order.returns.some(
          (r) =>
            r.id === dto.returnId &&
            ['RECEIVED', 'COMPLETED'].includes(r.status),
        )
      )
        commerceError('return must be received before refund');
      const mode = order.payments.find((p) => p.status === 'SUCCEEDED')?.mode;
      const refund = await tx.retailRefund.create({
        data: {
          ...dto,
          orderId: id,
          status: mode === 'DEMO' ? 'SUCCEEDED' : 'PENDING',
          providerReference:
            mode === 'DEMO' ? `DEMO-REFUND-${randomUUID()}` : null,
        },
      });
      if (mode === 'DEMO') await this.refundBalance(tx, id);
      return refund;
    });
    this.record(actor, 'order.refund.create', id, result);
    if (result.status === 'PENDING') {
      const delivered = await this.deliverProviderRefund(result.id);
      if (delivered.changed && delivered.refund.status !== 'PENDING')
        this.record(
          actor,
          'order.refund.external-result',
          id,
          delivered.refund,
        );
      return delivered.refund;
    }
    return result;
  }
  async refundResult(
    actor: JwtPayload,
    id: string,
    status: string,
    providerReference: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.retailRefund.findUniqueOrThrow({ where: { id } });
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${refund.orderId} FOR UPDATE`;
      const changed = await tx.retailRefund.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, providerReference },
      });
      if (!changed.count) commerceError('refund already resolved');
      await this.refundBalance(tx, refund.orderId);
      return tx.retailRefund.findUniqueOrThrow({ where: { id } });
    });
    this.record(actor, 'order.refund.external-result', result.orderId, result);
    return result;
  }
  private async refundBalance(tx: Prisma.TransactionClient, id: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id },
      include: { refunds: true },
    });
    const refunded = order.refunds
      .filter((r) => r.status === 'SUCCEEDED')
      .reduce((s, r) => s + r.amountCents, 0);
    await tx.order.update({
      where: { id },
      data: {
        paymentStatus:
          refunded >= order.totalCents
            ? 'REFUNDED'
            : refunded > 0
              ? 'PARTIALLY_REFUNDED'
              : 'PAID',
      },
    });
  }
  async reorder(actor: JwtPayload, id: string) {
    this.customer(actor);
    const order = await this.order(actor, id);
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId: actor.sub },
        create: { userId: actor.sub },
        update: {},
      });
      await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "id"=${cart.id} FOR UPDATE`;
      for (const item of order.items) {
        if (!item.variantId) commerceError(`SKU ${item.sku} was removed`);
        const v = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          include: { product: true, stock: true },
        });
        const price = resolveRetailPrice(v);
        if (!v.status || !isPublicProduct(v.product, order.market) || !price)
          commerceError(`SKU ${item.sku} is no longer available`);
        const existing = await tx.cartItem.findUnique({
          where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
        });
        const quantity = (existing?.quantity ?? 0) + item.quantity;
        if (quantity > (v.stock?.available ?? 0))
          commerceError(`insufficient stock for SKU ${item.sku}`);
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
          create: {
            cartId: cart.id,
            variantId: v.id,
            quantity,
            unitPriceCents: price.priceCents,
          },
          update: { quantity, unitPriceCents: price.priceCents },
        });
      }
      return { added: true };
    });
  }
  async document(actor: JwtPayload, id: string, kind: string) {
    const order = await this.order(actor, id);
    if (!['invoice', 'receipt', 'packing-list'].includes(kind))
      commerceError('unknown document type');
    if (
      kind === 'receipt' &&
      !['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)
    )
      commerceError('receipt requires a captured payment');
    return {
      kind,
      number: `${kind.toUpperCase()}-${order.orderNo}`,
      issuedAt: order.createdAt,
      order,
      notice:
        'Generated commercial record; statutory tax invoice numbering requires local accounting configuration.',
    };
  }
  async expire() {
    const rows = await this.prisma.order.findMany({
      where: { status: 'PENDING', reservationExpiresAt: { lte: new Date() } },
      select: { id: true },
      take: 100,
    });
    let released = 0;
    for (const row of rows) {
      const changed = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${row.id} FOR UPDATE`;
        const order = await tx.order.findUniqueOrThrow({
          where: { id: row.id },
          include: { items: true },
        });
        await this.inventory.lock(
          tx,
          order.items.map((i) => i.variantId),
          order.market,
        );
        if (
          order.status !== 'PENDING' ||
          !order.reservationExpiresAt ||
          order.reservationExpiresAt > new Date()
        )
          return;
        for (const item of order.items)
          if (item.variantId) {
            const remaining = item.quantity - item.shippedQuantity;
            if (remaining > 0) {
              await this.inventory.release(
                tx,
                item.variantId,
                remaining,
                order.market,
              );
            }
          }
        await tx.order.update({
          where: { id: row.id },
          data: { status: 'CANCELLED', paymentStatus: 'EXPIRED' },
        });
        await tx.retailPayment.updateMany({
          where: { orderId: row.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        if (order.couponCode)
          await tx.retailCoupon.updateMany({
            where: { code: order.couponCode, uses: { gt: 0 } },
            data: { uses: { decrement: 1 } },
          });
        released++;
        return true;
      });
      if (changed) await this.notifyOrder(row.id, 'order.expired');
    }
    return { released };
  }
  async inventoryAlerts() {
    const global = await this.prisma.stock.findMany({
      where: {
        OR: [
          { available: { lte: this.prisma.stock.fields.lowThreshold } },
          { syncError: { not: null } },
        ],
      },
      include: { variant: { select: { sku: true, name: true } } },
      take: 500,
    });
    const scoped = await this.prisma.marketInventory.findMany({
      where: {
        OR: [
          {
            available: { lte: this.prisma.marketInventory.fields.lowThreshold },
          },
          { syncError: { not: null } },
        ],
      },
      include: { variant: { select: { sku: true, name: true } } },
      take: 500,
    });
    return [...global.map((r) => ({ ...r, market: 'GLOBAL' })), ...scoped];
  }
  async deliverInventoryAlerts() {
    if (!this.notifications) return;
    const rows = await this.inventoryAlerts();
    for (const row of rows)
      await this.notifications.enqueueInternal({
        kind: row.syncError ? 'inventory.sync.failed' : 'inventory.low-stock',
        subject: `Inventory alert: ${row.variant.sku}`,
        text: `SKU ${row.variant.sku}, market ${row.market}: available ${row.available}, reserved ${row.reserved}, threshold ${row.lowThreshold}. Source: ${row.source}. ${row.syncError ? 'Source synchronization failed; new checkout is blocked.' : 'Replenishment is required.'}`,
        dedupeKey: `inventory:${row.market}:${row.variantId}:${row.updatedAt.toISOString()}`,
        variables: {
          reference: row.variant.sku,
          status: row.syncError ? 'CHECK_AVAILABILITY' : 'LOW_STOCK',
          link: `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/admin/products`,
        },
      });
  }
  private async paymentAlert(status: string, id: string) {
    this.logger.warn(`Retail payment requires attention: ${status}`);
    try {
      await this.notifications?.enqueueInternal({
        kind: 'commerce.payment.alert',
        subject: 'Retail payment requires attention',
        text: `Retail payment or refund ${id}: ${status}. Review the payment provider and order records. Retry with the existing idempotency key.`,
        dedupeKey: `payment-alert:${status}:${id}`,
        variables: {
          reference: id,
          status,
          link: `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/admin/orders`,
        },
      });
    } catch {
      this.logger.warn('Payment alert enqueue failed');
    }
  }
  private record(
    actor: JwtPayload,
    action: string,
    id: string,
    after: unknown,
  ) {
    void this.audit.record({
      actorKind: actor.kind === 'staff' ? 'STAFF' : 'CUSTOMER',
      ...(actor.kind === 'staff'
        ? { actorStaffId: actor.sub }
        : { actorCustomerId: actor.sub }),
      action,
      entityType: 'commerce',
      entityId: id,
      after,
    });
    if (action.startsWith('order.') && this.notifications)
      void this.notifyOrder(id, action).catch(() =>
        this.logger.warn('Order notification enqueue failed'),
      );
  }
  async notifyOrder(id: string, action: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });
    if (!order || !this.notifications) return;
    await this.notifications.enqueue({
      kind: action,
      to: order.user.email,
      subject: `WEMOVE ${order.orderNo} update`,
      text: `Your order ${order.orderNo} was updated: ${action.replace('order.', '')}. Status: ${order.status}; payment: ${order.paymentStatus}. View details: ${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/orders/${id}`,
      dedupeKey: `${action}:${id}:${order.updatedAt.toISOString()}`,
      variables: {
        reference: order.orderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        event: action,
        link: `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/orders/${id}`,
      },
    });
  }
}

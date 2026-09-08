import { createHmac, timingSafeEqual } from 'node:crypto';
import { BizException, ERROR_CODES } from '../common/errors.js';

export function commerceError(message: string): never {
  throw new BizException(ERROR_CODES.CONFLICT, message, 409);
}
export function money(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647)
    commerceError('invalid monetary amount');
  return value;
}
export function calculateTotals(
  subtotalCents: number,
  market: {
    taxBps: number;
    shippingCents: number;
    expressCents: number;
    freeShippingAboveCents: number | null;
  },
  coupon: {
    percentBps: number;
    amountCents: number;
    freeShipping?: boolean;
    eligibleCents?: number;
  } | null,
  shippingMethod: string,
) {
  money(subtotalCents);
  const eligibleCents = coupon?.eligibleCents ?? subtotalCents;
  const discountCents = Math.min(
    eligibleCents,
    coupon
      ? Math.round((eligibleCents * coupon.percentBps) / 10000) +
          coupon.amountCents
      : 0,
  );
  const shippingCents =
    coupon?.freeShipping ||
    (shippingMethod === 'STANDARD' &&
      market.freeShippingAboveCents !== null &&
      subtotalCents - discountCents >= market.freeShippingAboveCents)
      ? 0
      : shippingMethod === 'EXPRESS'
        ? market.expressCents
        : market.shippingCents;
  const taxCents = Math.round(
    ((subtotalCents - discountCents + shippingCents) * market.taxBps) / 10000,
  );
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: money(subtotalCents - discountCents + shippingCents + taxCents),
  };
}
export function validateLines(
  items: Array<{ orderItemId: string; quantity: number }>,
) {
  if (
    !items.length ||
    new Set(items.map((i) => i.orderItemId)).size !== items.length ||
    items.some((i) => !Number.isSafeInteger(i.quantity) || i.quantity < 1)
  )
    commerceError('line quantities must be positive and distinct');
}
export function paymentCanonical(event: {
  eventId: string;
  paymentId: string;
  status: string;
  amountCents: number;
  currency: string;
  providerReference: string;
}) {
  return JSON.stringify([
    event.eventId,
    event.paymentId,
    event.status,
    event.amountCents,
    event.currency,
    event.providerReference,
  ]);
}
export function signPayment(
  event: Parameters<typeof paymentCanonical>[0],
  timestamp: string,
  secret: string,
) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${paymentCanonical(event)}`)
    .digest('hex');
}
export function verifyPaymentSignature(
  event: Parameters<typeof paymentCanonical>[0],
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !/^\d{10,13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    commerceError('invalid or expired payment signature');
  const expected = Buffer.from(signPayment(event, timestamp, secret), 'hex');
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
    commerceError('invalid payment signature');
}
export function isPublicProduct(
  product: {
    status: string;
    markets?: string[];
    publishAt?: Date | null;
    unpublishAt?: Date | null;
  },
  market: string,
  now = new Date(),
) {
  return (
    (product.status === 'ACTIVE' ||
      (product.status === 'SCHEDULED' && !!product.publishAt)) &&
    (!product.markets?.length || product.markets.includes(market)) &&
    (!product.publishAt || product.publishAt <= now) &&
    (!product.unpublishAt || product.unpublishAt > now)
  );
}

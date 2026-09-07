import { describe, it, expect } from 'vitest';
import {
  calculateTotals,
  isPublicProduct,
  signPayment,
  validateLines,
  verifyPaymentSignature,
} from './commerce-rules.js';
const market = {
  taxBps: 825,
  shippingCents: 500,
  expressCents: 1500,
  freeShippingAboveCents: 10000,
};
describe('Commerce money, scheduling and payment authenticity', () => {
  it('calculates discounts before shipping thresholds and tax, rounding only minor units', () => {
    expect(
      calculateTotals(
        10500,
        market,
        { percentBps: 1000, amountCents: 0 },
        'STANDARD',
      ),
    ).toEqual({
      subtotalCents: 10500,
      discountCents: 1050,
      shippingCents: 500,
      taxCents: 821,
      totalCents: 10771,
    });
  });
  it('limits product coupons to eligible lines and handles free delivery', () => {
    expect(
      calculateTotals(
        5000,
        market,
        {
          percentBps: 5000,
          amountCents: 0,
          eligibleCents: 1000,
          freeShipping: true,
        },
        'EXPRESS',
      ),
    ).toMatchObject({
      discountCents: 500,
      shippingCents: 0,
      taxCents: 371,
      totalCents: 4871,
    });
  });
  it('rejects duplicate line ids before transactional stock writes', () => {
    expect(() =>
      validateLines([
        { orderItemId: 'line', quantity: 1 },
        { orderItemId: 'line', quantity: 2 },
      ]),
    ).toThrow();
    expect(() =>
      validateLines([{ orderItemId: 'line', quantity: 0 }]),
    ).toThrow();
  });
  it('does not expose scheduled, hidden, expired or market-restricted products early', () => {
    const now = new Date('2026-09-07T00:00:00Z');
    expect(
      isPublicProduct(
        { status: 'SCHEDULED', publishAt: new Date('2026-09-08') },
        'US',
        now,
      ),
    ).toBe(false);
    expect(
      isPublicProduct(
        { status: 'SCHEDULED', publishAt: new Date('2026-09-06') },
        'US',
        now,
      ),
    ).toBe(true);
    expect(
      isPublicProduct({ status: 'ACTIVE', markets: ['GB'] }, 'US', now),
    ).toBe(false);
    expect(isPublicProduct({ status: 'HIDDEN' }, 'US', now)).toBe(false);
  });
  it('authenticates the entire event and rejects replay outside the time window', () => {
    const event = {
      eventId: 'provider-event',
      paymentId: 'payment',
      status: 'SUCCEEDED',
      amountCents: 2500,
      currency: 'USD',
      providerReference: 'ref-123',
    };
    const timestamp = '1788739200000';
    const signature = signPayment(event, timestamp, 'test-secret');
    expect(() =>
      verifyPaymentSignature(
        event,
        timestamp,
        signature,
        'test-secret',
        Number(timestamp),
      ),
    ).not.toThrow();
    expect(() =>
      verifyPaymentSignature(
        { ...event, amountCents: 1 },
        timestamp,
        signature,
        'test-secret',
        Number(timestamp),
      ),
    ).toThrow();
    expect(() =>
      verifyPaymentSignature(
        event,
        timestamp,
        signature,
        'test-secret',
        Number(timestamp) + 300001,
      ),
    ).toThrow();
  });
});

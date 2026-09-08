import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { commerceError, money } from './commerce-rules.js';
export type ShippingRule = {
  method: string;
  minWeightGrams?: number;
  maxWeightGrams?: number;
  minSubtotalCents?: number;
  maxSubtotalCents?: number;
  amountCents: number;
};
type Market = {
  code: string;
  currency: string;
  taxBps: number;
  shippingCents: number;
  expressCents: number;
  freeShippingAboveCents: number | null;
  shippingRules: unknown;
  taxRegionRates: unknown;
  taxMode: string;
  shippingMode: string;
};
export function configuredShipping(
  rules: ShippingRule[],
  method: string,
  weightGrams: number,
  subtotalCents: number,
  fallback: number,
) {
  const matches = rules.filter(
    (r) =>
      r.method === method &&
      weightGrams >= (r.minWeightGrams ?? 0) &&
      (r.maxWeightGrams === undefined || weightGrams < r.maxWeightGrams) &&
      subtotalCents >= (r.minSubtotalCents ?? 0) &&
      (r.maxSubtotalCents === undefined || subtotalCents < r.maxSubtotalCents),
  );
  if (matches.length > 1)
    commerceError('Shipping rules overlap for this order');
  return {
    amountCents: money(matches[0]?.amountCents ?? fallback),
    source: matches.length ? 'WEIGHT_AMOUNT_RULE' : 'MARKET_FIXED',
  };
}
export function configuredTax(
  taxableCents: number,
  region: string,
  defaultBps: number,
  rates: Record<string, number>,
) {
  const rate = rates[region.toUpperCase()] ?? defaultBps;
  return {
    amountCents: money(Math.round((taxableCents * rate) / 10000)),
    rateBps: rate,
    source: 'MARKET_REGION_RATE',
  };
}

/** Boundary for tax and carrier adapters. Configured calculators remain fully usable without an external account. */
@Injectable()
export class TaxShippingService {
  private async external(
    kind: 'TAX' | 'SHIPPING',
    payload: Record<string, unknown>,
  ) {
    const url = process.env[`${kind}_PROVIDER_URL`],
      key = process.env[`${kind}_PROVIDER_KEY`];
    if (!url?.startsWith('https://') || !key)
      commerceError(`${kind} quote provider is not configured`);
    const body = JSON.stringify(payload),
      timestamp = String(Date.now()),
      idempotencyKey = createHash('sha256').update(body).digest('hex');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-quote-timestamp': timestamp,
          'x-quote-signature': createHmac('sha256', key)
            .update(`${timestamp}.${body}`)
            .digest('hex'),
          'idempotency-key': idempotencyKey,
        },
        body,
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
    } catch {
      commerceError(`${kind} quotation unavailable; retry checkout`);
    }
    if (!response.ok)
      commerceError(`${kind} quotation rejected (${response.status})`);
    const result = (await response.json().catch(() => null)) as {
      amountCents?: unknown;
      currency?: string;
      reference?: string;
    } | null;
    if (
      !result ||
      !Number.isSafeInteger(result.amountCents) ||
      result.currency !== payload.currency ||
      typeof result.reference !== 'string'
    )
      commerceError(`Invalid ${kind} quotation response`);
    return {
      amountCents: money(Number(result.amountCents)),
      source: `${kind}_PROVIDER`,
      reference: result.reference,
    };
  }
  async calculate(
    market: Market,
    address: { country: string; region?: string; postalCode: string },
    method: string,
    subtotalAfterDiscount: number,
    weightGrams: number,
    freeShipping: boolean,
  ) {
    const request = {
      market: market.code,
      currency: market.currency,
      address: {
        country: address.country,
        region: address.region,
        postalCode: address.postalCode,
      },
      method,
      subtotalCents: subtotalAfterDiscount,
      weightGrams,
    };
    const waived =
      freeShipping ||
      (method === 'STANDARD' &&
        market.freeShippingAboveCents !== null &&
        subtotalAfterDiscount >= market.freeShippingAboveCents);
    const shipping = waived
      ? { amountCents: 0, source: 'FREE_SHIPPING' }
      : market.shippingMode === 'HTTP'
        ? await this.external('SHIPPING', request)
        : configuredShipping(
            market.shippingRules as ShippingRule[],
            method,
            weightGrams,
            subtotalAfterDiscount,
            method === 'EXPRESS' ? market.expressCents : market.shippingCents,
          );
    const taxableCents = money(subtotalAfterDiscount + shipping.amountCents);
    const tax =
      market.taxMode === 'HTTP'
        ? await this.external('TAX', {
            ...request,
            taxableCents,
            shippingCents: shipping.amountCents,
          })
        : configuredTax(
            taxableCents,
            address.region ?? '',
            market.taxBps,
            market.taxRegionRates as Record<string, number>,
          );
    return {
      shippingCents: shipping.amountCents,
      taxCents: tax.amountCents,
      totalCents: money(taxableCents + tax.amountCents),
      calculationSnapshot: {
        shipping,
        tax,
        weightGrams,
        quotedAt: new Date().toISOString(),
      },
    };
  }
}

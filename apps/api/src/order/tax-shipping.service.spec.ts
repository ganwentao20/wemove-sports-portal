import { describe, it, expect, vi } from 'vitest';
import {
  configuredShipping,
  configuredTax,
  TaxShippingService,
} from './tax-shipping.service.js';
describe('Tax and shipping calculation boundaries', () => {
  const market = {
    code: 'US',
    currency: 'USD',
    taxBps: 1000,
    shippingCents: 500,
    expressCents: 900,
    freeShippingAboveCents: 5000,
    shippingRules: [
      {
        method: 'STANDARD',
        minWeightGrams: 0,
        maxWeightGrams: 1000,
        amountCents: 300,
      },
      { method: 'STANDARD', minWeightGrams: 1000, amountCents: 800 },
    ],
    taxRegionRates: { CA: 750 },
    taxMode: 'CONFIGURED',
    shippingMode: 'CONFIGURED',
  };
  it('uses exclusive upper weight bounds without overlapping rates', () => {
    expect(
      configuredShipping(market.shippingRules, 'STANDARD', 999, 2000, 500)
        .amountCents,
    ).toBe(300);
    expect(
      configuredShipping(market.shippingRules, 'STANDARD', 1000, 2000, 500)
        .amountCents,
    ).toBe(800);
    expect(
      configuredShipping(market.shippingRules, 'EXPRESS', 1000, 2000, 900)
        .amountCents,
    ).toBe(900);
  });
  it('rejects overlapping rules rather than silently choosing one', () => {
    expect(() =>
      configuredShipping(
        [
          { method: 'STANDARD', amountCents: 1 },
          { method: 'STANDARD', amountCents: 2 },
        ],
        'STANDARD',
        100,
        200,
        500,
      ),
    ).toThrow('overlap');
  });
  it('uses regional basis points and rounds once in minor units', () => {
    expect(configuredTax(333, 'ca', 1000, { CA: 750 })).toMatchObject({
      amountCents: 25,
      rateBps: 750,
    });
  });
  it('applies free delivery threshold after discounts and preserves calculation evidence', async () => {
    const service = new TaxShippingService();
    expect(
      await service.calculate(
        market,
        { country: 'US', region: 'CA', postalCode: '94016' },
        'STANDARD',
        4900,
        500,
        false,
      ),
    ).toMatchObject({
      shippingCents: 300,
      taxCents: 390,
      totalCents: 5590,
      calculationSnapshot: { shipping: { source: 'WEIGHT_AMOUNT_RULE' } },
    });
    expect(
      await service.calculate(
        market,
        { country: 'US', postalCode: '94016' },
        'STANDARD',
        5000,
        500,
        false,
      ),
    ).toMatchObject({ shippingCents: 0, taxCents: 500, totalCents: 5500 });
  });
  it('verifies provider currency and sends signed bounded quote requests', async () => {
    const oldUrl = process.env.TAX_PROVIDER_URL,
      oldKey = process.env.TAX_PROVIDER_KEY;
    process.env.TAX_PROVIDER_URL = 'https://tax.example.test/quote';
    process.env.TAX_PROVIDER_KEY = 'test-key';
    const stub = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          amountCents: 120,
          currency: 'USD',
          reference: 'tax-quote-1',
        }),
        { status: 200 },
      ),
    );
    try {
      const result = await new TaxShippingService().calculate(
        { ...market, taxMode: 'HTTP' },
        { country: 'US', postalCode: '94016' },
        'STANDARD',
        1000,
        500,
        false,
      );
      expect(result).toMatchObject({
        taxCents: 120,
        calculationSnapshot: {
          tax: { source: 'TAX_PROVIDER', reference: 'tax-quote-1' },
        },
      });
      expect(
        new Headers(stub.mock.calls[0][1]?.headers).get('x-quote-signature'),
      ).toMatch(/^[a-f0-9]{64}$/);
      stub.mockResolvedValue(
        new Response(
          JSON.stringify({
            amountCents: 120,
            currency: 'EUR',
            reference: 'bad',
          }),
          { status: 200 },
        ),
      );
      await expect(
        new TaxShippingService().calculate(
          { ...market, taxMode: 'HTTP' },
          { country: 'US', postalCode: '94016' },
          'STANDARD',
          1000,
          500,
          false,
        ),
      ).rejects.toThrow('Invalid TAX');
    } finally {
      stub.mockRestore();
      if (oldUrl === undefined) delete process.env.TAX_PROVIDER_URL;
      else process.env.TAX_PROVIDER_URL = oldUrl;
      if (oldKey === undefined) delete process.env.TAX_PROVIDER_KEY;
      else process.env.TAX_PROVIDER_KEY = oldKey;
    }
  });
});

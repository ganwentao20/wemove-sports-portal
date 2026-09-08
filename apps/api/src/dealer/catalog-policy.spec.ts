import { describe, it, expect } from 'vitest';
import {
  catalogWhere,
  catalogVariantWhere,
  parseQuickOrderCsv,
  purchaseRule,
} from './catalog-policy.js';
describe('dealer procurement policy', () => {
  it('parses BOM headers, quoted CSV and CRLF without silently accepting extra fields', () => {
    expect(
      parseQuickOrderCsv('\uFEFFsku,quantity\r\n"BALL-RED",12\r\nPAD,6'),
    ).toEqual([
      { sku: 'BALL-RED', quantity: 12 },
      { sku: 'PAD', quantity: 6 },
    ]);
    for (const csv of [
      'SKU,quantity\nA,1,admin',
      'A,-1',
      'A,1.5',
      '"A,1',
      'A,100001',
      '',
    ])
      expect(() => parseQuickOrderCsv(csv)).toThrow();
  });
  it('explicit empty product authorization denies all and combines selected product/category scope with publication and market', () => {
    expect(catalogWhere({ productIds: [] }, 'US')).toMatchObject({
      AND: expect.arrayContaining([{ OR: [{ id: { in: [] } }] }]),
    });
    expect(
      catalogWhere({ productIds: ['one'], categoryIds: ['sports'] }, 'US'),
    ).toMatchObject({
      AND: expect.arrayContaining([
        { OR: [{ id: { in: ['one'] } }, { categoryId: { in: ['sports'] } }] },
      ]),
    });
    expect(catalogWhere({ markets: ['CN'] }, 'US')).toEqual({ id: { in: [] } });
    expect(
      catalogWhere({ channels: ['RETAIL'], channel: 'WEB' }, 'US'),
    ).toEqual({ id: { in: [] } });
    expect(catalogVariantWhere({ variantIds: ['v1'] })).toEqual({
      id: { in: ['v1'] },
    });
  });
  it('SKU purchase rules override only the relevant defaults', () => {
    expect(
      purchaseRule(
        {
          moq: 12,
          multiple: 6,
          caseSize: 6,
          leadTimeDays: 4,
          skus: { BALL: { moq: 24, leadTimeDays: 10 } },
        },
        'BALL',
      ),
    ).toMatchObject({ moq: 24, multiple: 6, caseSize: 6, leadTimeDays: 10 });
  });
});

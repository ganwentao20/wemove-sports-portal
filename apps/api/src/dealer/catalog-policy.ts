import type { Prisma } from '@prisma/client';

export type CatalogPolicy = {
  productIds?: string[];
  variantIds?: string[];
  categoryIds?: string[];
  markets?: string[];
  channels?: string[];
  channel?: string;
};
export function catalogWhere(
  policy: Prisma.JsonValue | undefined,
  country?: string,
): Prisma.ProductWhereInput {
  const p = (policy ?? {}) as CatalogPolicy;
  if (
    (p.markets?.length && !p.markets.includes(country ?? '')) ||
    (p.channels?.length && !p.channels.includes(p.channel ?? ''))
  )
    return { id: { in: [] } };
  const access: Prisma.ProductWhereInput[] = [];
  if (p.productIds) access.push({ id: { in: p.productIds } });
  if (p.categoryIds) access.push({ categoryId: { in: p.categoryIds } });
  return {
    AND: [
      {
        OR: [
          { status: 'ACTIVE' },
          { status: 'SCHEDULED', publishAt: { not: null } },
        ],
      },
      ...(access.length ? [{ OR: access }] : []),
      { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      { OR: [{ unpublishAt: null }, { unpublishAt: { gt: new Date() } }] },
      ...(country
        ? [
            {
              OR: [
                { markets: { isEmpty: true } },
                { markets: { has: country } },
              ],
            },
          ]
        : []),
    ],
  };
}
export function catalogVariantWhere(
  policy: Prisma.JsonValue | undefined,
): Prisma.ProductVariantWhereInput {
  const p = (policy ?? {}) as CatalogPolicy;
  return p.variantIds ? { id: { in: p.variantIds } } : {};
}
export type PurchaseRules = {
  moq?: number;
  multiple?: number;
  caseSize?: number;
  caseWeightGrams?: number;
  leadTimeDays?: number;
  inventoryDisplay?: 'EXACT' | 'STATUS' | 'HIDDEN';
  skus?: Record<
    string,
    {
      moq?: number;
      multiple?: number;
      caseSize?: number;
      caseWeightGrams?: number;
      leadTimeDays?: number;
    }
  >;
};
export function purchaseRule(
  settings: Prisma.JsonValue | undefined,
  sku: string,
) {
  const defaults = (settings ?? {}) as PurchaseRules;
  return {
    moq: 1,
    multiple: 1,
    caseSize: 1,
    leadTimeDays: 0,
    ...defaults,
    ...defaults.skus?.[sku],
  };
}
export function parseQuickOrderCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else value += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows[0]?.[0]?.replace(/^\uFEFF/, '').toLowerCase() === 'sku')
    rows.shift();
  if (
    !rows.length ||
    rows.length > 100 ||
    rows.some(
      (r) =>
        r.length !== 2 ||
        !r[0] ||
        !/^\d+$/.test(r[1]) ||
        Number(r[1]) < 1 ||
        Number(r[1]) > 100000,
    )
  )
    throw new Error(
      'CSV must contain 1–100 SKU,quantity rows with positive integer quantities up to 100000',
    );
  return rows.map(([sku, quantity]) => ({ sku, quantity: Number(quantity) }));
}

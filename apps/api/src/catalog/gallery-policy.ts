import type { Prisma } from '@prisma/client';
/** The most specific complete gallery overrides broader galleries, retaining editorial order. */
export function galleryFor(
  value: unknown,
  locale: string,
  market: string,
): Prisma.JsonArray {
  if (!Array.isArray(value)) return [];
  const rows = value
    .map((row) => (typeof row === 'string' ? { url: row, alt: '' } : row))
    .filter(
      (row): row is Prisma.JsonObject =>
        !!row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        typeof row.url === 'string',
    );
  const predicates = [
    (row: Prisma.JsonObject) => row.locale === locale && row.market === market,
    (row: Prisma.JsonObject) => row.locale === locale && !row.market,
    (row: Prisma.JsonObject) => !row.locale && row.market === market,
    (row: Prisma.JsonObject) => !row.locale && !row.market,
  ];
  for (const match of predicates) {
    const selected = rows.filter(match);
    if (selected.length)
      return selected.map((row) => {
        const asset = { ...row };
        delete asset.locale;
        delete asset.market;
        return asset;
      });
  }
  return value.filter((row) => typeof row === 'string') as Prisma.JsonArray;
}

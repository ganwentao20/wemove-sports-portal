export type GuestCartLine = {
  variantId: string;
  productSlug?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};
type Detail = {
  slug: string;
  name: string;
  variants: Array<{ id: string; sku: string; name?: string | null }>;
};
/** Resolve current published names without changing a saved cart's quantities or price snapshots. */
export async function localizeGuestCart(
  rows: GuestCartLine[],
  locale: string,
  market: string,
  get: (path: string) => Promise<unknown>,
): Promise<GuestCartLine[]> {
  const cache = new Map<string, Promise<unknown>>();
  const request = (path: string) => {
    if (!cache.has(path)) cache.set(path, get(path));
    return cache.get(path)!;
  };
  const query = new URLSearchParams({ locale, market });
  return Promise.all(
    rows.map(async (line) => {
      try {
        let slugs = line.productSlug ? [line.productSlug] : [];
        if (!slugs.length && line.sku) {
          const result = (await request(
            `/products?${query}&search=${encodeURIComponent(line.sku)}&pageSize=24`,
          )) as { items: Array<{ slug: string }> };
          slugs = result.items.map((item) => item.slug);
        }
        for (const slug of slugs) {
          const product = (await request(
            `/products/${encodeURIComponent(slug)}?${query}`,
          )) as Detail;
          const variant = product.variants.find(
            (item) => item.id === line.variantId && item.sku === line.sku,
          );
          if (variant)
            return {
              ...line,
              productSlug: product.slug,
              name: variant.name
                ? `${product.name} · ${variant.name}`
                : product.name,
            };
        }
      } catch {
        /* Keep the cart usable when a product is unavailable or no longer public. */
      }
      return { ...line, name: line.sku || line.variantId };
    }),
  );
}

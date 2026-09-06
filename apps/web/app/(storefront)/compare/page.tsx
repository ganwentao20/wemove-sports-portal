import Link from "next/link";
import type { Metadata } from "next";
import { serverApiGet } from "../../../lib/server-api";

export const metadata: Metadata = { title: "Compare Products" };
export const dynamic = "force-dynamic";

type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  ageGuidance: string | null;
  category: { name: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    name: string | null;
    attrs: unknown;
    price: { priceCents: number } | null;
  }>;
};

type PageProps = {
  searchParams: Promise<{ ids?: string | string[] }>;
};

function variantFacts(product: ProductDetail) {
  const facts = new Map<string, Set<string>>();
  for (const variant of product.variants) {
    if (
      !variant.attrs ||
      typeof variant.attrs !== "object" ||
      Array.isArray(variant.attrs)
    )
      continue;
    for (const [key, value] of Object.entries(
      variant.attrs as Record<string, unknown>,
    )) {
      if (!["string", "number", "boolean"].includes(typeof value)) continue;
      const values = facts.get(key) ?? new Set<string>();
      values.add(String(value));
      facts.set(key, values);
    }
  }
  return [...facts].map(
    ([key, values]) => [key, [...values].join(", ")] as const,
  );
}

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawIds = Array.isArray(params.ids)
    ? params.ids.join(",")
    : (params.ids ?? "");
  const slugs = [
    ...new Set(
      rawIds
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const results = await Promise.all(
    slugs.map((slug) =>
      serverApiGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`),
    ),
  );
  const products = results.flatMap((result) =>
    result.ok ? [result.data] : [],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Compare products</h1>
      <p className="mt-2 text-neutral-600">
        Compare up to four active products. Enter catalog slugs separated by
        commas.
      </p>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          name="ids"
          defaultValue={slugs.join(",")}
          placeholder="product-one,product-two"
          className="min-w-0 flex-1 rounded-full border border-neutral-300 px-5 py-3 text-sm"
        />
        <button className="rounded-full bg-[var(--wm-dark)] px-6 py-3 text-sm font-semibold text-white">
          Compare
        </button>
      </form>

      {products.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => {
            const prices = product.variants.flatMap((variant) =>
              variant.price ? [variant.price.priceCents] : [],
            );
            return (
              <article
                key={product.id}
                className="rounded-2xl border border-neutral-200 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#2B5F8A]">
                  {product.category?.name ?? "Product"}
                </p>
                <h2 className="mt-2 text-lg font-semibold">{product.name}</h2>
                {product.summary && (
                  <p className="mt-2 text-sm text-neutral-600">
                    {product.summary}
                  </p>
                )}
                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="text-neutral-500">Starting price</dt>
                    <dd className="font-semibold">
                      {prices.length
                        ? `$${(Math.min(...prices) / 100).toFixed(2)}`
                        : "Contact us"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Variants</dt>
                    <dd className="font-semibold">{product.variants.length}</dd>
                  </div>
                  {variantFacts(product).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-neutral-500">{key}</dt>
                      <dd className="font-semibold">{value}</dd>
                    </div>
                  ))}
                  {product.ageGuidance && (
                    <div>
                      <dt className="text-neutral-500">Age guidance</dt>
                      <dd>{product.ageGuidance}</dd>
                    </div>
                  )}
                </dl>
                <Link
                  href={`/products/${product.slug}`}
                  className="mt-5 inline-block text-sm font-semibold text-[#2B5F8A] underline"
                >
                  View product
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          Add a product from its detail page, or enter product slugs above.
        </p>
      )}

      {products.length !== slugs.length && slugs.length > 0 && (
        <p role="status" className="mt-4 text-sm text-amber-700">
          One or more products were unavailable or not published and were
          omitted.
        </p>
      )}
    </div>
  );
}

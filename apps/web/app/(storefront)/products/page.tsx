import Link from "next/link";
import type { Metadata } from "next";
import { serverApiGet } from "../../../lib/server-api";

export const metadata: Metadata = {
  title: "All Products",
  description: "Browse WEMOVE SPORTS active play toys and games.",
};

export const dynamic = "force-dynamic";

type ProductCard = {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  categorySlug?: string;
  priceCents: number | null;
};
type ProductPage = {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
type Category = {
  code: string;
  slug: string;
  name: string;
  productCount: number;
};

function queryValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = queryValue(params.search).slice(0, 64);
  const category = queryValue(params.category).slice(0, 64);
  const requestedPage = Number.parseInt(queryValue(params.page), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const query = new URLSearchParams({ page: String(page), pageSize: "18" });
  if (search) query.set("search", search);
  if (category) query.set("categorySlug", category);

  const [productsResult, categoriesResult] = await Promise.all([
    serverApiGet<ProductPage>(`/products?${query}`),
    serverApiGet<Category[]>("/categories"),
  ]);
  const products = productsResult.ok ? productsResult.data : null;
  const productsError = productsResult.ok ? null : productsResult.message;
  const categories = categoriesResult.ok ? categoriesResult.data : [];

  function pageHref(nextPage: number): string {
    const nextQuery = new URLSearchParams({ page: String(nextPage) });
    if (search) nextQuery.set("search", search);
    if (category) nextQuery.set("category", category);
    return `/products?${nextQuery}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">All Products</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {products
            ? `${products.total} active products`
            : "Live catalog unavailable"}
        </p>
      </div>

      <form
        action="/products"
        className="mt-6 grid gap-3 rounded-2xl bg-neutral-50 p-4 sm:grid-cols-[1fr_220px_auto]"
      >
        <input
          name="search"
          defaultValue={search}
          maxLength={64}
          placeholder="Search products"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name} ({item.productCount})
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-[var(--wm-dark)] px-5 py-3 text-sm font-semibold text-white">
          Apply
        </button>
      </form>

      {!products ? (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          {productsError} Please try again shortly.
        </p>
      ) : products.items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-neutral-500">
          No products match these filters.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.items.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group rounded-2xl border border-neutral-200 p-4 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex aspect-square items-center justify-center rounded-xl bg-neutral-100 text-5xl transition-transform group-hover:scale-[1.01]">
                ⚽
              </div>
              {product.categorySlug && (
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  {product.categorySlug}
                </p>
              )}
              <h2 className="mt-1 font-semibold group-hover:text-[var(--wm-primary)]">
                {product.name}
              </h2>
              {product.summary && (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                  {product.summary}
                </p>
              )}
              <p className="mt-3 text-sm font-bold text-[var(--wm-primary)]">
                {product.priceCents === null
                  ? "Contact us"
                  : `From $${(product.priceCents / 100).toFixed(2)}`}
              </p>
            </Link>
          ))}
        </div>
      )}

      {products && products.totalPages > 1 && (
        <nav
          className="mt-8 flex justify-center gap-3 text-sm"
          aria-label="Product pagination"
        >
          {products.page > 1 && (
            <Link
              className="rounded-lg border px-4 py-2"
              href={pageHref(products.page - 1)}
            >
              Previous
            </Link>
          )}
          <span className="px-2 py-2 text-neutral-500">
            Page {products.page} of {products.totalPages}
          </span>
          {products.page < products.totalPages && (
            <Link
              className="rounded-lg border px-4 py-2"
              href={pageHref(products.page + 1)}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { CatalogVisual } from "../../../components/catalog-visual";
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
  const categories = categoriesResult.ok ? categoriesResult.data : [];
  const totalPages = products
    ? Math.ceil(products.total / products.pageSize)
    : 0;

  function pageHref(nextPage: number): string {
    const nextQuery = new URLSearchParams({ page: String(nextPage) });
    if (search) nextQuery.set("search", search);
    if (category) nextQuery.set("category", category);
    return `/products?${nextQuery}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="wm-reveal max-w-2xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--wm-primary)]">The active play catalog</p>
        <h1 className="text-4xl font-extrabold tracking-[-0.05em] text-[var(--wm-dark)] sm:text-6xl">Choose the next move.</h1>
        <p className="mt-4 text-base leading-7 text-[var(--wm-muted)]">
          {products
            ? `${products.total} active products, made for everyday play.`
            : "Browse by activity, age and the way your family likes to play."}
        </p>
      </div>

      <form
        action="/products"
        className="mt-10 grid gap-3 rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-4 shadow-[0_18px_50px_rgba(var(--wm-shadow)/0.07)] md:grid-cols-[1fr_220px_auto]"
      >
        <label className="sr-only" htmlFor="product-search">Search products</label>
        <input
          id="product-search"
          name="search"
          defaultValue={search}
          maxLength={64}
          placeholder="Search products"
          className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-bg)] px-4 py-3 text-sm text-[var(--wm-text)] outline-none placeholder:text-[var(--wm-muted)] focus:border-[var(--wm-primary)]"
        />
        <label className="sr-only" htmlFor="product-category">Product category</label>
        <select
          id="product-category"
          name="category"
          defaultValue={category}
          className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-bg)] px-4 py-3 text-sm text-[var(--wm-text)] focus:border-[var(--wm-primary)]"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name} ({item.productCount})
            </option>
          ))}
        </select>
        <button className="whitespace-nowrap rounded-xl bg-[var(--wm-primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--wm-primary-strong)] active:translate-y-px">
          Show results
        </button>
      </form>

      {!products ? (
        <div role="status" className="mt-10 grid overflow-hidden rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] md:grid-cols-[0.72fr_1.28fr]">
          <CatalogVisual name="WEMOVE catalog preview" priority className="min-h-64 md:min-h-80" />
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <h2 className="text-2xl font-extrabold tracking-[-0.035em]">The live catalog is taking a timeout.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--wm-muted)]">The storefront is ready, but product data is not reachable right now. Try again shortly or contact our team for the current range.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/products" className="rounded-xl bg-[var(--wm-dark)] px-5 py-3 text-sm font-bold text-[var(--wm-surface)]">Try again</Link>
              <Link href="/contact" className="rounded-xl border border-[var(--wm-border)] px-5 py-3 text-sm font-bold hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]">Contact us</Link>
            </div>
          </div>
        </div>
      ) : products.items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--wm-border)] bg-[var(--wm-surface)] p-10 text-center">
          <h2 className="text-xl font-bold">No exact match yet</h2>
          <p className="mt-2 text-sm text-[var(--wm-muted)]">Clear a filter or try a broader product name.</p>
          <Link href="/products" className="mt-5 inline-flex text-sm font-bold text-[var(--wm-primary)]">Clear filters</Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {products.items.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group"
            >
              <CatalogVisual name={product.name} className="aspect-[4/5] rounded-2xl" />
              {product.categorySlug && (
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--wm-muted)]">
                  {product.categorySlug}
                </p>
              )}
              <h2 className={`${product.categorySlug ? "mt-1.5" : "mt-4"} text-lg font-bold tracking-[-0.025em] group-hover:text-[var(--wm-primary)]`}>
                {product.name}
              </h2>
              {product.summary && (
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--wm-muted)]">
                  {product.summary}
                </p>
              )}
              <p className="mt-3 text-sm font-extrabold text-[var(--wm-primary)]">
                {product.priceCents === null
                  ? "Contact us"
                  : `From $${(product.priceCents / 100).toFixed(2)}`}
              </p>
            </Link>
          ))}
        </div>
      )}

      {products && totalPages > 1 && (
        <nav
          className="mt-12 flex items-center justify-center gap-3 text-sm"
          aria-label="Product pagination"
        >
          {products.page > 1 && (
            <Link
              className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-2.5 font-semibold hover:border-[var(--wm-primary)]"
              href={pageHref(products.page - 1)}
            >
              Previous
            </Link>
          )}
          <span className="px-2 py-2 text-[var(--wm-muted)]">
            Page {products.page} of {totalPages}
          </span>
          {products.page < totalPages && (
            <Link
              className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-2.5 font-semibold hover:border-[var(--wm-primary)]"
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

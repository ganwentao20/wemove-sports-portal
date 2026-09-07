import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CatalogVisual } from "../../../components/catalog-visual";
import { serverApiGet } from "../../../lib/server-api";
import { getLocale, getMarket, SITE_URL } from "../../../lib/locale";
import { WishlistButton } from "../../../components/wishlist-button";
import { CatalogAnalytics } from "../../../components/catalog-analytics";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const market = queryValue(params.market) || (await getMarket());
  const categorySlug = queryValue(params.category);
  const categoryResponse = categorySlug
    ? await serverApiGet<Category[]>("/categories?market=" + market)
    : null;
  const category = categoryResponse?.ok
    ? categoryResponse.data.find((c) => c.slug === categorySlug)
    : undefined;
  const seo = category?.seo ?? {};
  const filtered = Object.keys(params).some(
    (k) => !["page", "market", "category"].includes(k) && params[k],
  );
  const canonical = String(
    seo.canonical ||
      `${SITE_URL}/en/products?${new URLSearchParams({ ...(category ? { category: category.slug } : {}), market })}`,
  );
  return {
    title: String(seo.title || category?.name || "All Products"),
    description: String(
      seo.description ||
        category?.description ||
        "Browse WEMOVE SPORTS active play toys and games.",
    ),
    alternates: { canonical: new URL(canonical, SITE_URL).href },
    robots: {
      index:
        process.env.DEPLOYMENT_ENV === "production" &&
        !filtered &&
        (!categorySlug || !!category) &&
        !seo.noindex &&
        !String(seo.robots ?? "").includes("noindex"),
      follow: true,
    },
    openGraph: {
      title: String(
        seo.ogTitle || seo.title || category?.name || "All Products",
      ),
      description: String(
        seo.ogDescription || seo.description || category?.description || "",
      ),
      ...(seo.ogImage || category?.coverImage?.url
        ? { images: [String(seo.ogImage || category?.coverImage?.url)] }
        : {}),
    },
  };
}

export const dynamic = "force-dynamic";

type ProductCard = {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  categorySlug?: string;
  priceCents: number | null;
  currency: string;
  retailEnabled: boolean;
  tags: string[];
  ageMin: number | null;
  ageMax: number | null;
  availability: string;
  coverImage?: { url?: string; alt?: string };
};
type ProductPage = {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  sort?: string;
};
type Category = {
  code: string;
  slug: string;
  name: string;
  productCount: number;
  filterableFields?: string[];
  description?: string | null;
  coverImage?: { url: string; alt: string } | null;
  seo?: Record<string, unknown> | null;
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
  const dealerAccount = (await cookies()).has("wm_dealer_session");
  const locale = await getLocale(),
    market = queryValue(params.market) || (await getMarket());
  if (locale !== "en") {
    const preserved = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) value.forEach((v) => preserved.append(key, v));
      else if (value !== undefined) preserved.set(key, value);
    }
    preserved.set("market", market);
    redirect(`/en/products?${preserved}`);
  }
  const search = queryValue(params.search).slice(0, 64);
  const category = queryValue(params.category).slice(0, 64);
  const requestedPage = Number.parseInt(queryValue(params.page), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const query = new URLSearchParams({ page: String(page), pageSize: "18" });
  if (search) query.set("search", search);
  if (category) query.set("categorySlug", category);
  query.set("market", market);
  query.set("locale", locale);
  for (const key of ["scene", "skill", "tag", "age", "stock", "sort"]) {
    const value = queryValue(params[key]);
    if (value) query.set(key, value);
  }
  for (const key of ["minPrice", "maxPrice"]) {
    const value = queryValue(params[key]);
    if (value && Number.isFinite(Number(value)))
      query.set(key, String(Math.round(Number(value) * 100)));
  }

  const [productsResult, categoriesResult] = await Promise.all([
    serverApiGet<ProductPage>(`/products?${query}`),
    serverApiGet<Category[]>("/categories?market=" + market),
  ]);
  const products = productsResult.ok ? productsResult.data : null;
  const categories = categoriesResult.ok ? categoriesResult.data : [];
  const activeCategory = categories.find((c) => c.slug === category);
  const suggested =
    products?.items.length === 0
      ? await serverApiGet<ProductPage>(
          `/products?market=${market}&locale=en&pageSize=4&sort=featured`,
        )
      : null;
  const recommendations = suggested?.ok ? suggested.data.items : [];
  const canFilter = (field: string) =>
    !category ||
    (
      categories.find((c) => c.slug === category)?.filterableFields ?? [
        "age",
        "scene",
        "skill",
        "stock",
        "price",
      ]
    ).includes(field);
  const totalPages = products
    ? Math.ceil(products.total / products.pageSize)
    : 0;

  function pageHref(nextPage: number): string {
    const nextQuery = new URLSearchParams({ page: String(nextPage) });
    if (search) nextQuery.set("search", search);
    if (category) nextQuery.set("category", category);
    for (const key of [
      "market",
      "scene",
      "skill",
      "tag",
      "age",
      "stock",
      "sort",
      "minPrice",
      "maxPrice",
    ]) {
      const value = key === "market" ? market : queryValue(params[key]);
      if (value) nextQuery.set(key, value);
    }
    return `/products?${nextQuery}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
      <CatalogAnalytics
        filters={[
          "category",
          "age",
          "scene",
          "skill",
          "stock",
          "sort",
          "minPrice",
          "maxPrice",
        ].filter((k) => Boolean(params[k]))}
      />
      <div className="wm-reveal max-w-2xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--wm-primary)]">
          The active play catalog
        </p>
        <h1 className="text-4xl font-extrabold tracking-[-0.05em] text-[var(--wm-dark)] sm:text-6xl">
          {activeCategory?.name ?? "Choose the next move."}
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--wm-muted)]">
          {activeCategory?.description ||
            (products
              ? `${products.total} active products, made for everyday play.`
              : "Browse by activity, age and the way your family likes to play.")}
        </p>
      </div>
      {activeCategory?.coverImage?.url && (
        <CatalogVisual
          className="mt-8 aspect-[3/1] max-h-80 rounded-2xl"
          name={activeCategory.coverImage.alt || activeCategory.name}
          imageUrl={activeCategory.coverImage.url}
          priority
        />
      )}

      <form
        action="/products"
        className="mt-10 grid gap-3 rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-4 shadow-[0_18px_50px_rgba(var(--wm-shadow)/0.07)] md:grid-cols-[1fr_220px_auto]"
      >
        <input name="market" value={market} type="hidden" />
        <label className="sr-only" htmlFor="product-search">
          Search products
        </label>
        <input
          id="product-search"
          name="search"
          defaultValue={search}
          maxLength={64}
          placeholder="Search products"
          className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-bg)] px-4 py-3 text-sm text-[var(--wm-text)] outline-none placeholder:text-[var(--wm-muted)] focus:border-[var(--wm-primary)]"
        />
        <label className="sr-only" htmlFor="product-category">
          Product category
        </label>
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
        <label className="text-sm">
          Age
          <input
            name="age"
            disabled={!canFilter("age")}
            type="number"
            min="0"
            max="120"
            defaultValue={queryValue(params.age)}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="text-sm">
          Scene
          <select
            name="scene"
            disabled={!canFilter("scene")}
            defaultValue={queryValue(params.scene)}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="">All</option>
            {["Indoor", "Outdoor", "Family", "School"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Skill
          <input
            name="skill"
            disabled={!canFilter("skill")}
            defaultValue={queryValue(params.skill)}
            className="mt-1 w-full rounded-xl border p-3"
            placeholder="Balance, coordination…"
          />
        </label>
        <label className="text-sm">
          Minimum price
          <input
            name="minPrice"
            disabled={!canFilter("price")}
            type="number"
            min="0"
            step="0.01"
            defaultValue={queryValue(params.minPrice)}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="text-sm">
          Maximum price
          <input
            name="maxPrice"
            disabled={!canFilter("price")}
            type="number"
            min="0"
            step="0.01"
            defaultValue={queryValue(params.maxPrice)}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="text-sm">
          Availability
          <select
            name="stock"
            disabled={!canFilter("stock")}
            defaultValue={queryValue(params.stock)}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="all">All products</option>
            <option value="in">In stock</option>
          </select>
        </label>
        <label className="text-sm">
          Sort
          <select
            name="sort"
            defaultValue={
              queryValue(params.sort) || products?.sort || "featured"
            }
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name</option>
          </select>
        </label>
        <button className="whitespace-nowrap rounded-xl bg-[var(--wm-primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--wm-primary-strong)] active:translate-y-px">
          Show results
        </button>
      </form>

      {!products ? (
        <div
          role="status"
          className="mt-10 grid overflow-hidden rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] md:grid-cols-[0.72fr_1.28fr]"
        >
          <CatalogVisual
            name="WEMOVE catalog preview"
            priority
            className="min-h-64 md:min-h-80"
          />
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <h2 className="text-2xl font-extrabold tracking-[-0.035em]">
              The live catalog is taking a timeout.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--wm-muted)]">
              The storefront is ready, but product data is not reachable right
              now. Try again shortly or contact our team for the current range.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="rounded-xl bg-[var(--wm-dark)] px-5 py-3 text-sm font-bold text-[var(--wm-surface)]"
              >
                Try again
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border border-[var(--wm-border)] px-5 py-3 text-sm font-bold hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      ) : products.items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--wm-border)] bg-[var(--wm-surface)] p-10 text-center">
          <h2 className="text-xl font-bold">No exact match yet</h2>
          <p className="mt-2 text-sm text-[var(--wm-muted)]">
            Clear a filter or try a broader product name.
          </p>
          <Link
            href={`/en/products?market=${market}`}
            className="mt-5 inline-flex text-sm font-bold text-[var(--wm-primary)]"
          >
            Clear filters
          </Link>
          <nav
            aria-label="Browse categories"
            className="mt-4 flex flex-wrap justify-center gap-3"
          >
            {categories.map((c) => (
              <Link
                key={c.slug}
                className="rounded-lg border px-3 py-2 text-sm"
                href={`/en/products?category=${encodeURIComponent(c.slug)}&market=${market}`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
          {recommendations.length > 0 && (
            <section
              className="mt-8 text-left"
              data-module-id="empty-catalog-recommendations"
            >
              <h3 className="text-xl font-bold">Explore these products</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recommendations.map((p) => (
                  <Link
                    key={p.id}
                    href={`/en/products/${p.slug}?market=${market}`}
                    className="rounded-xl border p-4"
                  >
                    <CatalogVisual
                      name={p.coverImage?.alt || p.name}
                      imageUrl={p.coverImage?.url}
                      className="aspect-square rounded-lg"
                    />
                    <p className="mt-3 font-semibold">{p.name}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {products.items.map((product) => (
            <article key={product.id}>
              <Link
                href={`/products/${product.slug}?market=${market}`}
                className="group"
              >
                <CatalogVisual
                  name={product.coverImage?.alt || product.name}
                  imageUrl={
                    product.coverImage?.url?.startsWith("/media/")
                      ? `/api/v1${product.coverImage.url}`
                      : product.coverImage?.url
                  }
                  className="aspect-[4/5] rounded-2xl"
                />
                <p className="mt-3 text-xs font-semibold">
                  {product.ageMin !== null
                    ? `Ages ${product.ageMin}–${product.ageMax ?? "+"} · `
                    : ""}
                  {product.tags?.join(" · ")}
                  {product.availability === "OUT_OF_STOCK"
                    ? " · Out of stock"
                    : ""}
                </p>
                {product.categorySlug && (
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--wm-muted)]">
                    {product.categorySlug}
                  </p>
                )}
                <h2
                  className={`${product.categorySlug ? "mt-1.5" : "mt-4"} text-lg font-bold tracking-[-0.025em] group-hover:text-[var(--wm-primary)]`}
                >
                  {product.name}
                </h2>
                {product.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--wm-muted)]">
                    {product.summary}
                  </p>
                )}
                <p className="mt-3 text-sm font-extrabold text-[var(--wm-primary)]">
                  {dealerAccount
                    ? "Check dealer price and minimum order"
                    : product.priceCents === null
                      ? "Contact us"
                      : `From ${product.currency} ${(product.priceCents / 100).toFixed(2)}`}
                </p>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                {dealerAccount && (
                  <Link
                    className="rounded-full border px-5 py-2 text-sm"
                    href={`/dealer/catalog?productId=${product.id}`}
                  >
                    Authorized dealer catalog
                  </Link>
                )}
                <WishlistButton productId={product.id} />
                <Link
                  className="rounded-full border px-5 py-2 text-sm"
                  href={`/compare?ids=${product.slug}`}
                >
                  Compare
                </Link>
              </div>
            </article>
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

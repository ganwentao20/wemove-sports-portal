import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CatalogVisual } from "../../../components/catalog-visual";
import { serverApiGet } from "../../../lib/server-api";
import { getLocale, getMarket, SITE_URL } from "../../../lib/locale";
import { WishlistButton } from "../../../components/wishlist-button";
import { CatalogAnalytics } from "../../../components/catalog-analytics";
import { catalogCopy, catalogLanguage } from "../../../lib/catalog-copy";
import { publicUrl } from "../../../lib/public-url";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const requestedLocale = await getLocale();
  const locale = catalogLanguage(requestedLocale) ? requestedLocale : "en";
  const copy = catalogCopy(locale);
  const market = queryValue(params.market) || (await getMarket());
  const categorySlug = queryValue(params.category);
  const categoryResponse = categorySlug
    ? await serverApiGet<Category[]>(
        `/categories?market=${market}&locale=${locale}`,
      )
    : null;
  const category = categoryResponse?.ok
    ? categoryResponse.data.find((c) => c.slug === categorySlug)
    : undefined;
  const seo = category?.seo ?? {};
  const title = String(seo.title || category?.name || copy.allProducts);
  const description = String(
    seo.description || category?.description || copy.description,
  );
  const filtered = Object.keys(params).some(
    (k) => !["page", "market", "category"].includes(k) && params[k],
  );
  const canonical = String(
    seo.canonical ||
      `${SITE_URL}/${locale}/products?${new URLSearchParams({ ...(category ? { category: category.slug } : {}), market })}`,
  );
  return {
    title,
    description,
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
      title: String(seo.ogTitle || title),
      description: String(seo.ogDescription || description),
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
  tagLabels?: Record<string, string>;
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
  if (!catalogLanguage(locale)) {
    const preserved = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) value.forEach((v) => preserved.append(key, v));
      else if (value !== undefined) preserved.set(key, value);
    }
    preserved.set("market", market);
    redirect(`/en/products?${preserved}`);
  }
  const copy = catalogCopy(locale);
  const url = (path: string) => publicUrl(path, locale, market);
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
    serverApiGet<Category[]>(`/categories?market=${market}&locale=${locale}`),
  ]);
  const products = productsResult.ok ? productsResult.data : null;
  const categories = categoriesResult.ok ? categoriesResult.data : [];
  const activeCategory = categories.find((c) => c.slug === category);
  const suggested =
    products?.items.length === 0
      ? await serverApiGet<ProductPage>(
          `/products?market=${market}&locale=${locale}&pageSize=4&sort=featured`,
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
    return url(`/products?${nextQuery}`);
  }

  return (
    <div className="wm-original-catalog mx-auto max-w-[1600px] px-4 py-12 sm:px-6 lg:py-16">
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
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[#7a7a73]">
          {copy.eyebrow}
        </p>
        <h1 className="text-4xl font-normal tracking-[-0.035em] text-[#333] sm:text-5xl">
          {activeCategory?.name ?? copy.title}
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--wm-muted)]">
          {activeCategory?.description ||
            (products ? copy.count(products.total) : copy.browse)}
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
        action={`/${locale}/products`}
        className="mt-10 grid gap-3 border-y border-[#deded8] bg-white py-5 md:grid-cols-[1fr_220px_auto]"
      >
        <input name="market" value={market} type="hidden" />
        {queryValue(params.tag) && (
          <input name="tag" value={queryValue(params.tag)} type="hidden" />
        )}
        <label className="sr-only" htmlFor="product-search">
          {copy.search}
        </label>
        <input
          id="product-search"
          name="search"
          defaultValue={search}
          maxLength={64}
          placeholder={copy.search}
          className="rounded-[3px] border border-[#d5d5cf] bg-white px-4 py-3 text-sm text-[var(--wm-text)] outline-none placeholder:text-[var(--wm-muted)] focus:border-[#6f8060]"
        />
        <label className="sr-only" htmlFor="product-category">
          {copy.category}
        </label>
        <select
          id="product-category"
          name="category"
          defaultValue={category}
          className="rounded-[3px] border border-[#d5d5cf] bg-white px-4 py-3 text-sm text-[var(--wm-text)] focus:border-[#6f8060]"
        >
          <option value="">{copy.allCategories}</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name} ({item.productCount})
            </option>
          ))}
        </select>
        <label className="text-sm">
          {copy.age}
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
          {copy.scene}
          <select
            name="scene"
            disabled={!canFilter("scene")}
            defaultValue={queryValue(params.scene)}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="">{copy.all}</option>
            {Object.entries(copy.scenes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {copy.skill}
          <input
            name="skill"
            disabled={!canFilter("skill")}
            defaultValue={queryValue(params.skill)}
            className="mt-1 w-full rounded-xl border p-3"
            placeholder={copy.skillPlaceholder}
          />
        </label>
        <label className="text-sm">
          {copy.minPrice}
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
          {copy.maxPrice}
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
          {copy.availability}
          <select
            name="stock"
            disabled={!canFilter("stock")}
            defaultValue={queryValue(params.stock)}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="all">{copy.allProducts}</option>
            <option value="in">{copy.inStock}</option>
          </select>
        </label>
        <label className="text-sm">
          {copy.sort}
          <select
            name="sort"
            defaultValue={
              queryValue(params.sort) || products?.sort || "featured"
            }
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="featured">{copy.featured}</option>
            <option value="newest">{copy.newest}</option>
            <option value="price-asc">{copy.priceAsc}</option>
            <option value="price-desc">{copy.priceDesc}</option>
            <option value="name">{copy.name}</option>
          </select>
        </label>
        <button className="whitespace-nowrap rounded-[3px] bg-[#333] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#171717] active:translate-y-px">
          {copy.showResults}
        </button>
      </form>

      {!products ? (
        <div
          role="status"
          className="mt-10 grid overflow-hidden rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] md:grid-cols-[0.72fr_1.28fr]"
        >
          <CatalogVisual
            name={copy.preview}
            priority
            className="min-h-64 md:min-h-80"
          />
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <h2 className="text-2xl font-extrabold tracking-[-0.035em]">
              {copy.unavailable}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--wm-muted)]">
              {copy.unavailableDescription}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={pageHref(page)}
                className="rounded-xl bg-[var(--wm-dark)] px-5 py-3 text-sm font-bold text-[var(--wm-surface)]"
              >
                {copy.retry}
              </Link>
              <Link
                href={url("/contact")}
                className="rounded-xl border border-[var(--wm-border)] px-5 py-3 text-sm font-bold hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]"
              >
                {copy.contact}
              </Link>
            </div>
          </div>
        </div>
      ) : products.items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--wm-border)] bg-[var(--wm-surface)] p-10 text-center">
          <h2 className="text-xl font-bold">{copy.noMatch}</h2>
          <p className="mt-2 text-sm text-[var(--wm-muted)]">
            {copy.noMatchDescription}
          </p>
          <Link
            href={url("/products")}
            className="mt-5 inline-flex text-sm font-bold text-[var(--wm-primary)]"
          >
            {copy.clear}
          </Link>
          <nav
            aria-label={copy.browseCategories}
            className="mt-4 flex flex-wrap justify-center gap-3"
          >
            {categories.map((c) => (
              <Link
                key={c.slug}
                className="rounded-lg border px-3 py-2 text-sm"
                href={url(`/products?category=${encodeURIComponent(c.slug)}`)}
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
              <h3 className="text-xl font-bold">{copy.recommendations}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recommendations.map((p) => (
                  <Link
                    key={p.id}
                    href={url(`/products/${encodeURIComponent(p.slug)}`)}
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
                href={url(`/products/${encodeURIComponent(product.slug)}`)}
                className="group"
              >
                <CatalogVisual
                  name={product.coverImage?.alt || product.name}
                  imageUrl={
                    product.coverImage?.url?.startsWith("/media/")
                      ? `/api/v1${product.coverImage.url}`
                      : product.coverImage?.url
                  }
                className="aspect-[4/5] rounded-[6px]"
                />
                <p className="mt-3 text-xs font-semibold">
                  {product.ageMin !== null
                    ? `${copy.ages(product.ageMin, product.ageMax)} · `
                    : ""}
                  {product.tags
                    ?.map((tag) => product.tagLabels?.[tag] ?? tag)
                    .join(" · ")}
                  {product.availability === "OUT_OF_STOCK"
                    ? ` · ${copy.outOfStock}`
                    : ""}
                </p>
                {product.categorySlug && (
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--wm-muted)]">
                    {categories.find((c) => c.slug === product.categorySlug)
                      ?.name ?? product.categorySlug}
                  </p>
                )}
                <h2
                  className={`${product.categorySlug ? "mt-1.5" : "mt-4"} text-lg font-medium tracking-[-0.02em] text-[#333] group-hover:text-[#667658]`}
                >
                  {product.name}
                </h2>
                {product.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--wm-muted)]">
                    {product.summary}
                  </p>
                )}
                <p className="mt-3 text-sm font-semibold text-[#5f7052]">
                  {dealerAccount
                    ? copy.dealerPrice
                    : product.priceCents === null
                      ? copy.contact
                      : copy.from(
                          `${product.currency} ${(product.priceCents / 100).toFixed(2)}`,
                        )}
                </p>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                {dealerAccount && (
                  <Link
                    className="rounded-full border px-5 py-2 text-sm"
                    href={url(
                      `/dealer/catalog?productId=${encodeURIComponent(product.id)}`,
                    )}
                  >
                    {copy.dealerCatalog}
                  </Link>
                )}
                <WishlistButton productId={product.id} locale={locale} />
                <Link
                  className="rounded-full border px-5 py-2 text-sm"
                  href={url(`/compare?ids=${encodeURIComponent(product.slug)}`)}
                >
                  {copy.compare}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {products && totalPages > 1 && (
        <nav
          className="mt-12 flex items-center justify-center gap-3 text-sm"
          aria-label={copy.pagination}
        >
          {products.page > 1 && (
            <Link
              className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-2.5 font-semibold hover:border-[var(--wm-primary)]"
              href={pageHref(products.page - 1)}
            >
              {copy.previous}
            </Link>
          )}
          <span className="px-2 py-2 text-[var(--wm-muted)]">
            {copy.page(products.page, totalPages)}
          </span>
          {products.page < totalPages && (
            <Link
              className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-2.5 font-semibold hover:border-[var(--wm-primary)]"
              href={pageHref(products.page + 1)}
            >
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

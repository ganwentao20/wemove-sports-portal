import Image from "next/image";
import Link from "next/link";
import { serverApiGet } from "../lib/server-api";
import { getMarket } from "../lib/locale";
import { CatalogVisual } from "./catalog-visual";
type Entry = {
  id: string;
  name: string;
  title?: string;
  slug: string;
  summary?: string;
  productCount?: number;
  priceCents?: number | null;
  currency?: string;
  retailEnabled?: boolean;
  coverImage?: { url?: string; alt?: string };
};
export async function ContentCollection({
  type,
  props,
  locale,
}: {
  type: string;
  props: Record<string, unknown>;
  locale: string;
}) {
  const market = await getMarket(),
    limit = Math.max(1, Math.min(24, Number(props.limit) || 8));
  let items: Entry[] = [];
  if (type === "categories") {
    const result = await serverApiGet<Array<Entry>>(
      `/categories?locale=${locale}&market=${market}`,
    );
    items = result.ok ? result.data : [];
  } else if (type === "articles") {
    const result = await serverApiGet<Array<Entry>>(
      `/cms/pages?kind=ARTICLE&locale=${locale}&market=${market}`,
    );
    items = result.ok ? result.data : [];
    if (Array.isArray(props.articleIds) && props.articleIds.length) {
      const chosen = props.articleIds;
      items = items
        .filter((item) => chosen.includes(item.id))
        .sort((a, b) => chosen.indexOf(a.id) - chosen.indexOf(b.id));
    } else if (props.category)
      items = items.filter(
        (item) =>
          (item as Entry & { category?: string }).category === props.category,
      );
  } else {
    const params = new URLSearchParams({
      pageSize: String(limit),
      locale,
      market,
      sort: props.sort === "newest" ? "newest" : "featured",
    });
    if (props.category) params.set("categorySlug", String(props.category));
    if (props.tag) params.set("tag", String(props.tag));
    if (Array.isArray(props.productIds) && props.productIds.length)
      params.set("ids", props.productIds.slice(0, 24).join(","));
    const result = await serverApiGet<{ items: Entry[] }>(
      `/products?${params}`,
    );
    items = result.ok ? result.data.items : [];
    if (Array.isArray(props.productIds) && props.productIds.length) {
      const order = props.productIds;
      items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
  }
  return (
    <section data-module-id={String(props.id ?? type)}>
      <h2 className="text-3xl font-bold">{String(props.title ?? "")}</h2>
      {items.length === 0 && (
        <p className="mt-4 text-[var(--wm-muted)]">
          {locale === "zh" ? "暂无可展示的内容。" : "No content available yet."}
        </p>
      )}
      <div
        className={`mt-6 grid gap-5 sm:grid-cols-2 ${Math.min(items.length, limit) === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
      >
        {items.slice(0, limit).map((item) => (
          <Link
            key={item.id ?? item.slug}
            aria-label={item.title ?? item.name}
            href={`/${locale}${type === "categories" ? `/products?category=${encodeURIComponent(item.slug)}&market=${market}` : type === "articles" ? `/content/${item.slug}?market=${market}` : `/products/${item.slug}?market=${market}`}`}
            className="wm-collection-card group flex flex-col overflow-hidden rounded-xl border border-[var(--wm-border)] bg-white"
          >
            {type === "products" ? (
              <CatalogVisual
                name={item.name}
                imageUrl={item.coverImage?.url}
                className="aspect-[4/3] w-full"
              />
            ) : item.coverImage?.url ? (
              <Image
                src={item.coverImage.url}
                alt={item.coverImage.alt ?? item.name}
                width={400}
                height={300}
                sizes="(max-width:640px) 100vw,25vw"
                unoptimized={item.coverImage.url.startsWith("https:")}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : null}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-bold">{item.title ?? item.name}</h3>
              {item.summary && (
                <p className="mt-3 line-clamp-3 text-sm leading-6">
                  {item.summary}
                </p>
              )}
              {item.productCount !== undefined && (
                <p className="mt-2 text-sm">
                  {item.productCount} {locale === "zh" ? "个产品" : "products"}
                </p>
              )}
              {type === "products" &&
                item.retailEnabled &&
                item.priceCents != null &&
                item.currency && (
                  <p className="mt-4 font-semibold text-[var(--wm-primary)]">
                    {locale === "zh" ? "起价 " : "From "}
                    {new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: item.currency,
                    }).format(item.priceCents / 100)}
                  </p>
                )}
              <span className="mt-auto pt-5 text-sm font-semibold text-[var(--wm-muted)]">
                {locale === "zh" ? "查看详情" : "View details"}
                <span
                  aria-hidden="true"
                  className="ml-2 inline-block transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1"
                >
                  →
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

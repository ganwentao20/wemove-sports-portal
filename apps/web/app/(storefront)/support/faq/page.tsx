import { getUiText } from "../../../../lib/ui-i18n-server";
import { serverApiGet } from "../../../../lib/server-api";
import { ContentBlocks } from "../../../../components/content-blocks";
import { getLocale, getMarket } from "../../../../lib/locale";
import { contentText } from "../../../../lib/content-text";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Frequently asked questions") };
}
type Question = {
  id: string;
  title: string;
  category?: string;
  sections: unknown;
  productIds: string[];
  sortOrder: number;
};
type Product = { id: string; name: string };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; productId?: string }>;
}) {
  const t = await getUiText();
  const filters = await searchParams,
    market = await getMarket(),
    locale = await getLocale();
  const result = await serverApiGet<Question[]>(
      "/cms/pages?kind=FAQ&locale=" + locale + "&market=" + market,
    ),
    rows = result.ok ? result.data : [];
  const ids = [...new Set(rows.flatMap((p) => p.productIds ?? []))],
    groups: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += 24)
    groups.push(ids.slice(offset, offset + 24));
  const references = await Promise.all(
    groups.map((group) =>
      serverApiGet<{ items: Product[] }>(
        "/products?ids=" +
          group.join(",") +
          "&pageSize=24&locale=" +
          locale +
          "&market=" +
          market,
      ),
    ),
  );
  const products = references
    .flatMap((result) => (result.ok ? result.data.items : []))
    .sort((a, b) => a.name.localeCompare(b.name));
  const matched = rows.filter(
    (p) =>
      (!filters.category || p.category === filters.category) &&
      (!filters.productId || p.productIds.includes(filters.productId)) &&
      (p.title + " " + contentText(p.sections))
        .toLowerCase()
        .includes((filters.q ?? "").toLowerCase()),
  );
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: matched.map((p) => ({
      "@type": "Question",
      name: p.title,
      acceptedAnswer: { "@type": "Answer", text: contentText(p.sections) },
    })),
  };
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="mb-8 text-4xl font-bold">
        {t("Frequently asked questions")}
      </h1>
      <form className="mb-8 flex flex-wrap items-end gap-3">
        <input type="hidden" name="market" value={market} />
        <label>
          {t("Search")}
          <input
            name="q"
            defaultValue={filters.q}
            className="mt-1 block rounded-lg border p-2"
          />
        </label>
        <label>
          {t("Category")}
          <select
            name="category"
            defaultValue={filters.category}
            className="mt-1 block rounded-lg border p-2"
          >
            <option value="">{t("All categories")}</option>
            {Array.from(
              new Set(rows.map((p) => p.category).filter(Boolean)),
            ).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Product")}
          <select
            name="productId"
            defaultValue={filters.productId}
            className="mt-1 block max-w-72 rounded-lg border p-2"
          >
            <option value="">{t("All products and general questions")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg border px-4 py-2">{t("Search")}</button>
        <a
          className="px-3 py-2 underline"
          href={"/" + locale + "/support/faq?market=" + market}
        >
          {t("Clear filters")}
        </a>
      </form>
      <div className="space-y-5">
        {matched.map((p) => (
          <details key={p.id} className="rounded-xl border p-5">
            <summary className="cursor-pointer font-semibold">
              {p.title}
            </summary>
            <div className="mt-4">
              <ContentBlocks sections={p.sections} locale={locale} />
            </div>
          </details>
        ))}
      </div>
      {!matched.length && (
        <p role="status">
          {t(
            "No published questions match your search. Please contact support.",
          )}
        </p>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replaceAll("<", "\\u003c"),
        }}
      />
    </div>
  );
}

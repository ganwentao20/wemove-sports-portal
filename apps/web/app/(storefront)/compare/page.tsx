import { getUiText } from "../../../lib/ui-i18n-server";
import Link from "next/link";
import { serverApiGet } from "../../../lib/server-api";
import { getLocale, getMarket, SITE_URL } from "../../../lib/locale";
import { ShareLink } from "../../../components/share-link";
export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Compare products") };
}
export const dynamic = "force-dynamic";
type Product = {
  id: string;
  slug: string;
  name: string;
  ageGuidance: string | null;
  ageMin: number | null;
  ageMax: number | null;
  scenes: string[];
  skills: string[];
  playGuide: string | null;
  currency: string;
  category: { name: string } | null;
  specifications: Record<string, unknown>;
  variants: Array<{
    sku: string;
    attrs: unknown;
    price: { priceCents: number } | null;
    availability?: string;
    weightGrams?: number;
  }>;
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const t = await getUiText();
  const params = await searchParams;
  const locale = await getLocale(),
    market = await getMarket();
  const slugs = [
    ...new Set(
      (Array.isArray(params.ids) ? params.ids.join(",") : (params.ids ?? ""))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const [catalog, ...results] = await Promise.all([
    serverApiGet<{ items: Array<{ slug: string; name: string }> }>(
      `/products?pageSize=100&market=${market}&locale=${locale}`,
    ),
    ...slugs.map((s) =>
      serverApiGet<Product>(
        `/products/${encodeURIComponent(s)}?market=${market}&locale=${locale}`,
      ),
    ),
  ]);
  const options = catalog.ok
    ? (catalog.data as { items: Array<{ slug: string; name: string }> }).items
    : [];
  const products = results.flatMap((r) => (r.ok ? [r.data as Product] : []));
  const facts = products.map((p) => {
    const prices = p.variants.flatMap((v) =>
      v.price ? [v.price.priceCents] : [],
    );
    const attrs: Record<string, string> = {
      Category: p.category?.name ?? "—",
      "Age guidance": p.ageGuidance ?? "—",
      Ages: p.ageMin !== null ? `${p.ageMin}–${p.ageMax ?? "+"}` : "—",
      Scenes: p.scenes.map((value) => t(value)).join(", ") || "—",
      Skills: p.skills.map((value) => t(value)).join(", ") || "—",
      "How to play": p.playGuide || "—",
      Availability:
        [
          ...new Set(
            p.variants
              .map((v) => (v.availability ? t(v.availability) : null))
              .filter(Boolean),
          ),
        ].join(", ") || "—",
      "Weight (g)":
        p.variants
          .map((v) => v.weightGrams)
          .filter(Boolean)
          .join(", ") || "—",
      "Starting price": prices.length
        ? `${p.currency} ${(Math.min(...prices) / 100).toFixed(2)}`
        : "Contact us",
      SKU: p.variants.map((v) => v.sku).join(", "),
    };
    for (const [k, v] of Object.entries(p.specifications ?? {}))
      if (["string", "number", "boolean"].includes(typeof v))
        attrs[k] = String(v);
    for (const variant of p.variants)
      if (
        variant.attrs &&
        typeof variant.attrs === "object" &&
        !Array.isArray(variant.attrs)
      )
        for (const [k, v] of Object.entries(variant.attrs))
          if (["string", "number", "boolean"].includes(typeof v))
            attrs[k] = attrs[k] ? `${attrs[k]}, ${v}` : String(v);
    return attrs;
  });
  const keys = [...new Set(facts.flatMap((f) => Object.keys(f)))];
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-4xl font-bold">
        {locale === "zh" ? "产品比较" : t("Compare products")}
      </h1>
      <p className="mt-3 text-neutral-600">
        {t("Choose up to four products. Highlighted rows show differences.")}
      </p>
      <div className="mt-4">
        <ShareLink
          title={t("WEMOVE product comparison")}
          url={`${SITE_URL}/${locale}/compare?ids=${encodeURIComponent(slugs.join(","))}&market=${market}`}
        />
      </div>
      <form className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3].map((index) => (
          <label key={index} className="text-sm">
            {t("Product {number}", { number: index + 1 })}
            <select
              name="ids"
              defaultValue={slugs[index] ?? ""}
              className="mt-2 w-full rounded-lg border p-3"
            >
              <option value="">{t("Select product")}</option>
              {options.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button className="self-end rounded-lg bg-neutral-900 px-5 py-3 text-white">
          {t("Compare")}
        </button>
      </form>
      {products.length ? (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              {t("Product comparison with differences highlighted")}
            </caption>
            <thead>
              <tr>
                <th className="p-4">{t("Feature")}</th>
                {products.map((p) => (
                  <th key={p.id} className="p-4">
                    <Link
                      className="text-base underline"
                      href={`/products/${p.slug}?market=${market}`}
                    >
                      {p.name}
                    </Link>
                    <Link
                      className="mt-2 block text-xs font-normal underline"
                      href={`/compare?ids=${slugs.filter((s) => s !== p.slug).join(",")}`}
                    >
                      {t("Remove")}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const different =
                  new Set(facts.map((f) => f[k] ?? "—")).size > 1;
                return (
                  <tr
                    key={k}
                    className={`border-t ${different ? "bg-amber-50" : ""}`}
                  >
                    <th className="sticky left-0 z-10 bg-white p-4 font-medium">
                      {t(k)}
                      {different && (
                        <span className="ml-2 text-xs text-amber-800">
                          {t("Different")}
                        </span>
                      )}
                    </th>
                    {facts.map((f, index) => (
                      <td key={products[index].id} className="p-4">
                        {t(f[k] ?? "—")}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 rounded-xl border p-8">
          {t("Select products above to compare.")}
        </p>
      )}
      {products.length !== slugs.length && (
        <p role="status" className="mt-4 text-amber-800">
          {t("Some selected products are no longer published in this market.")}
        </p>
      )}
    </div>
  );
}

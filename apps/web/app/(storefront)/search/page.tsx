import { redirect } from "next/navigation";
import { publicUrl } from "../../../lib/public-url";
import Link from "next/link";
import { serverApiGet } from "../../../lib/server-api";
import { getLocale, getMarket } from "../../../lib/locale";
import { SearchBox } from "../../../components/search-box";
import { SearchAnalytics } from "../../../components/search-analytics";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};
type Results = {
  locale: string;
  items: Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    url: string;
  }>;
  total: number;
  page: number;
  suggestions: string[];
  recommendations: Array<{ title: string; url: string }>;
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const input = await searchParams,
    locale = await getLocale(),
    market = await getMarket();
  const params = new URLSearchParams({
    q: input.q ?? "",
    type: input.type ?? "ALL",
    page: input.page ?? "1",
    locale,
    market,
  });
  const result = await serverApiGet<Results>(`/search?${params}`);
  if (result.ok && result.data.locale !== locale)
    redirect(`/en/search?${params}`);
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="mb-6 text-4xl font-bold">
        {locale === "zh" ? "搜索" : "Search"}
      </h1>
      <SearchBox initial={input.q ?? ""} locale={locale} market={market} />
      <nav className="my-6 flex flex-wrap gap-3" aria-label="Result type">
        {["ALL", "PRODUCT", "ARTICLE", "FAQ", "DOWNLOAD"].map((type) => (
          <Link
            key={type}
            href={`?q=${encodeURIComponent(input.q ?? "")}&type=${type}&market=${market}`}
            className={`rounded-lg border px-4 py-2 ${type === (input.type ?? "ALL") ? "bg-sky-50" : ""}`}
          >
            {type}
          </Link>
        ))}
      </nav>
      {result.ok ? (
        <>
          <SearchAnalytics query={input.q ?? ""} total={result.data.total} />
          <p className="mb-5" role="status">
            {result.data.total} results
          </p>
          <ul data-search-results className="divide-y">
            {result.data.items.map((item) => (
              <li key={`${item.type}-${item.id}`} className="py-6">
                <small>{item.type}</small>
                <h2 className="mt-1 text-xl font-semibold">
                  <Link
                    data-product-id={
                      item.type === "PRODUCT" ? item.id : undefined
                    }
                    className="underline"
                    href={publicUrl(item.url, locale, market)}
                  >
                    {item.title}
                  </Link>
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">
                  {item.summary}
                </p>
              </li>
            ))}
          </ul>
          {result.data.total === 0 && (
            <section className="rounded-xl border p-6">
              <h2 className="font-bold">
                Try a broader phrase or browse these products
              </h2>
              {result.data.suggestions.length > 0 && (
                <p className="my-3">
                  Did you mean:{" "}
                  {result.data.suggestions.map((suggestion) => (
                    <Link
                      key={suggestion}
                      className="mr-3 underline"
                      href={`?q=${encodeURIComponent(suggestion)}&market=${market}`}
                    >
                      {suggestion}
                    </Link>
                  ))}
                </p>
              )}
              <Link
                href={`?q=${encodeURIComponent(input.q ?? "")}&market=${market}`}
                className="mr-4 underline"
              >
                Clear type filters
              </Link>
              <Link
                href={`/${locale}/search?market=${market}`}
                className="underline"
              >
                Clear search
              </Link>
              <ul className="my-4 space-y-2">
                {result.data.recommendations.map((p) => (
                  <li key={p.url}>
                    <Link
                      className="underline"
                      href={publicUrl(p.url, locale, market)}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/contact" className="underline">
                Contact support
              </Link>
            </section>
          )}
          <nav className="mt-6 flex gap-4" aria-label="Search pages">
            {result.data.page > 1 && (
              <Link
                href={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(result.data.page - 1) })}`}
              >
                Previous
              </Link>
            )}
            {result.data.page * 20 < result.data.total && (
              <Link
                href={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(result.data.page + 1) })}`}
              >
                Next
              </Link>
            )}
          </nav>
        </>
      ) : (
        <p role="alert">Search temporarily unavailable. Please try again.</p>
      )}
    </div>
  );
}

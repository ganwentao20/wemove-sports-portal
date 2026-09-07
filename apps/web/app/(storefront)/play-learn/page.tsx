import Link from "next/link";
import { serverApiGet } from "../../../lib/server-api";
import { getMarket } from "../../../lib/locale";
import { contentText } from "../../../lib/content-text";
export const dynamic = "force-dynamic";
export const metadata = { title: "Play & Learn" };
type Article = {
  id: string;
  title: string;
  slug: string;
  sections: unknown;
  category?: string;
  author?: string;
  updatedAt: string;
};
export default async function PlayLearnPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const filters = await searchParams,
    market = await getMarket(),
    result = await serverApiGet<Article[]>(
      "/cms/pages?kind=ARTICLE&locale=en&market=" + market,
    ),
    articles = result.ok ? result.data : [],
    categories = [...new Set(articles.map((a) => a.category).filter(Boolean))],
    matched = articles.filter(
      (a) =>
        (!filters.category || a.category === filters.category) &&
        (a.title + " " + contentText(a.sections))
          .toLowerCase()
          .includes((filters.q ?? "").toLowerCase()),
    ),
    page = Math.max(1, Number(filters.page) || 1),
    pageSize = 12,
    query = (next: number) =>
      "?" +
      new URLSearchParams({
        q: filters.q ?? "",
        category: filters.category ?? "",
        market,
        page: String(next),
      });
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">Play &amp; Learn</h1>
      <p className="mt-3 text-neutral-600">
        Activity guides, skills and ideas for active family play.
      </p>
      <form className="my-8 flex flex-wrap gap-4">
        <input type="hidden" name="market" value={market} />
        <label>
          Search guides
          <input
            name="q"
            defaultValue={filters.q}
            className="mt-2 block rounded-lg border p-3"
          />
        </label>
        <label>
          Category
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="mt-2 block rounded-lg border p-3"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button className="self-end rounded-lg border px-5 py-3">
          Find guides
        </button>
      </form>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {matched.slice((page - 1) * pageSize, page * pageSize).map((a) => (
          <article key={a.id} className="rounded-2xl border p-6">
            <p className="text-sm font-semibold text-[var(--wm-primary)]">
              {a.category || "Play guide"}
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              <Link
                className="underline"
                href={"/en/content/" + a.slug + "?market=" + market}
              >
                {a.title}
              </Link>
            </h2>
            <p className="mt-4 line-clamp-5 text-sm leading-7 text-neutral-600">
              {contentText(a.sections)}
            </p>
            <p className="mt-5 text-xs text-neutral-600">
              {a.author && a.author + " · "}
              <time dateTime={a.updatedAt}>
                {new Date(a.updatedAt).toLocaleDateString("en-US")}
              </time>
            </p>
          </article>
        ))}
      </div>
      {!matched.length && (
        <p role="status">No published guides match your search.</p>
      )}
      <nav aria-label="Guide pages" className="mt-8 flex gap-5">
        {page > 1 && <Link href={query(page - 1)}>Previous</Link>}
        {page * pageSize < matched.length && (
          <Link href={query(page + 1)}>Next</Link>
        )}
      </nav>
    </div>
  );
}

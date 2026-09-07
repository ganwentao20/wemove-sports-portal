import Link from "next/link";
import { serverApiGet } from "../../../../lib/server-api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Downloads" };
type Asset = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  version: number;
  language: string;
  resourceType: string;
  tags: string[];
  publishedAt: string;
  productIds: string[];
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    asset?: string;
    language?: string;
    product?: string;
  }>;
}) {
  const query = await searchParams,
    result = await serverApiGet<Asset[]>("/media/public"),
    all = result.ok ? result.data : [];
  const rows = all.filter(
    (row) =>
      (!query.asset || row.id === query.asset) &&
      [row.title, row.fileName, ...row.tags]
        .join(" ")
        .toLowerCase()
        .includes((query.q ?? "").toLowerCase()) &&
      (!query.type || row.resourceType === query.type) &&
      (!query.language || row.language === query.language) &&
      (!query.product || row.productIds.includes(query.product)),
  );
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-4xl font-bold">Downloads</h1>
      <p className="my-5">
        Published instructions, certificates and resources.{" "}
        <Link href="/customer/account" className="underline">
          Customer account
        </Link>{" "}
        ·{" "}
        <Link href="/dealer/downloads" className="underline">
          Dealer resources
        </Link>
      </p>
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label>
          Title or tag
          <input
            name="q"
            defaultValue={query.q}
            className="ml-2 rounded border p-2"
          />
        </label>
        <label>
          Resource type
          <select
            name="type"
            defaultValue={query.type}
            className="ml-2 rounded border p-2"
          >
            <option value="">All</option>
            {[...new Set(all.map((row) => row.resourceType))]
              .sort()
              .map((type) => (
                <option key={type}>{type}</option>
              ))}
          </select>
        </label>
        <label>
          Language
          <select
            name="language"
            defaultValue={query.language}
            className="ml-2 rounded border p-2"
          >
            <option value="">All languages</option>
            {[...new Set(all.map((row) => row.language))]
              .sort()
              .map((language) => (
                <option key={language}>{language}</option>
              ))}
          </select>
        </label>
        {query.product && (
          <input type="hidden" name="product" value={query.product} />
        )}
        <button className="rounded border px-4 py-2">Filter</button>
        <Link href="/support/downloads" className="p-2 underline">
          Clear filters
        </Link>
      </form>
      <p role="status" className="mb-4">
        {rows.length} resources
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id}>
            <a
              href={`/api/v1${row.downloadUrl}`}
              data-asset-id={row.id}
              className="block rounded-xl border p-5"
            >
              <h2 className="font-bold">{row.title || row.fileName}</h2>
              <p className="mt-2 text-sm">
                {row.resourceType} · {row.language} ·{" "}
                {(row.sizeBytes / 1024).toFixed(1)} KB · Version {row.version}
              </p>
              <p className="mt-2 text-sm">
                Published {row.publishedAt.slice(0, 10)}
              </p>
              {row.tags.length > 0 && (
                <p className="mt-2 text-sm text-neutral-600">
                  {row.tags.join(" · ")}
                </p>
              )}
            </a>
          </li>
        ))}
      </ul>
      {!result.ok ? (
        <p role="alert">
          Resources are temporarily unavailable. Please try again.
        </p>
      ) : (
        !rows.length && <p>No published files match these filters.</p>
      )}
    </div>
  );
}

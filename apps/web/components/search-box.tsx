"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { publicUrl } from "../lib/public-url";
export function SearchBox({
  initial = "",
  locale = "en",
  market = "US",
}: {
  initial?: string;
  locale?: string;
  market?: string;
}) {
  const [value, setValue] = useState(initial),
    [items, setItems] = useState<
      Array<{ id: string; title: string; url: string; type: string }>
    >([]);
  useEffect(() => {
    if (value.trim().length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(
        `/api/v1/search?q=${encodeURIComponent(value)}&locale=${locale}&market=${market}`,
        { signal: controller.signal },
      )
        .then((r) => r.json())
        .then((r) => setItems((r.data?.items ?? []).slice(0, 6)))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, locale, market]);
  return (
    <div className="relative">
      <form action={`/${locale}/search`} className="flex gap-3">
        <label className="min-w-0 flex-1">
          {locale === "zh"
            ? "搜索产品、文章、常见问题和资料"
            : "Search products, articles, FAQs and downloads"}
          <input
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={100}
            className="mt-2 w-full rounded-xl border p-3"
            autoComplete="off"
          />
        </label>
        <input type="hidden" name="market" value={market} />
        <button className="self-end rounded-xl bg-[var(--wm-primary)] px-5 py-3 font-semibold text-white">
          {locale === "zh" ? "搜索" : "Search"}
        </button>
      </form>
      {items.length > 0 && value !== initial && (
        <ul
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-30 mt-1 rounded-xl border bg-white p-2 shadow-lg"
        >
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <Link
                href={publicUrl(item.url, locale, market)}
                className="block rounded p-3 hover:bg-sky-50"
              >
                {item.title}
                <small className="ml-3">{item.type}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

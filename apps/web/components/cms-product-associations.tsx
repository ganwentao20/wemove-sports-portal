"use client";
import { useEffect, useState } from "react";
import { secureApiFetch } from "../lib/secure-api";
type Product = { id: string; name: string; slug: string; status: string };
export function CmsProductAssociations({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Product[]>([]),
    [selected, setSelected] = useState<Record<string, Product>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void secureApiFetch<Product[]>(
        "staff",
        "/admin/cms/products?search=" + encodeURIComponent(query),
        { signal: controller.signal },
      )
        .then(setResults)
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e instanceof Error ? e.message : "Unable to find products",
            );
        });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    let active = true;
    void secureApiFetch<Product[]>("staff", "/admin/cms/products?ids=" + key)
      .then((rows) => {
        if (active)
          setSelected((current) => ({
            ...current,
            ...Object.fromEntries(rows.map((p) => [p.id, p])),
          }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key]);
  return (
    <fieldset className="sm:col-span-2 rounded-xl border p-4">
      <legend className="px-2 font-semibold">Associated products</legend>
      <p className="text-sm text-neutral-600">
        Article pages show these product cards automatically. FAQ entries appear
        on each selected product; leave the selection empty for a general FAQ.
      </p>
      <label className="mt-3 block">
        Find products
        <input
          className="mt-1 w-full rounded-lg border p-2.5"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError("");
          }}
          placeholder="Product name or slug"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <ul className="mt-3 flex flex-wrap gap-2">
        {results
          .filter((p) => !ids.includes(p.id))
          .map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={ids.length >= 24}
                className="rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50"
                onClick={() => {
                  setSelected((current) => ({ ...current, [p.id]: p }));
                  onChange([...ids, p.id]);
                }}
              >
                + {p.name}{" "}
                <span className="text-neutral-600">({p.status})</span>
              </button>
            </li>
          ))}
      </ul>
      {!results.length && (
        <p className="mt-2 text-sm" role="status">
          No matching products.
        </p>
      )}
      <ol className="mt-4 space-y-2">
        {ids.map((id, index) => (
          <li
            key={id}
            className="flex items-center gap-3 rounded-lg bg-neutral-50 p-2"
          >
            <span className="flex-1">{selected[id]?.name ?? id}</span>
            <button
              type="button"
              aria-label={`Move associated product ${index + 1} up`}
              disabled={index === 0}
              className="rounded border px-3 py-2"
              onClick={() => {
                const next = [...ids];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={() => onChange(ids.filter((v) => v !== id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-neutral-600">{ids.length}/24 selected</p>
    </fieldset>
  );
}

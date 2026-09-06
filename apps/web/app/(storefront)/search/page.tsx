import type { Metadata } from "next";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Search products</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Search the live WEMOVE catalog by product name or description.
      </p>
      <form action="/products" className="mt-6 flex gap-3">
        <input
          name="search"
          required
          maxLength={64}
          placeholder="Try “bowling set”…"
          className="min-w-0 flex-1 rounded-full border border-neutral-300 px-5 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
        />
        <button className="rounded-full bg-[var(--wm-dark)] px-6 py-3 text-sm font-semibold text-white">
          Search
        </button>
      </form>
    </div>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

/** 全站搜索（服务端对接 /api/v1/products?search= 或独立 search API，组员 A/C 联调） */
export default function SearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Search</h1>
      <input
        placeholder="Try &quot;bowling set&quot;…"
        className="mt-6 w-full rounded-full border border-neutral-300 px-5 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
      />
      <p className="mt-4 text-sm text-neutral-400">Results placeholder</p>
    </div>
  );
}

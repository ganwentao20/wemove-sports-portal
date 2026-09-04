import Link from 'next/link';
import type { Metadata } from 'next';

/**
 * PLP 商品列表（骨架 · ISR 示例页）：
 * - `export const revalidate = 60`：每 60s 增量再生成（ISR，SEO 答辩点）
 * - 数据接线：列表数据来自 GET /api/v1/products（lib/api.ts），
 *   API 未启动时回退到下方演示数据 —— 接线后删除 MOCK。
 * 筛选器（分类/价格/属性多维筛）由组员 A 实现。
 */
export const metadata: Metadata = {
  title: 'All Products',
  description: 'Browse WEMOVE SPORTS active play toys — bowling sets, balance boards and more.',
};

export const revalidate = 60;

const MOCK_PRODUCTS = [
  { slug: 'strike-kids-bowling-set-6-pin', name: 'Strike! Kids Bowling Set — 6 Pins', price: '$29.99' },
  { slug: 'balance-board-wooden-arc', name: 'Wooden Balance Board — Arc', price: '$19.99' },
  { slug: 'ring-toss-outdoor-game-set', name: 'Ring Toss Outdoor Game Set', price: '$14.99' },
];

export default async function ProductsPage() {
  // 接线示例（API 就绪后启用）：
  // const paged = await apiGet<{ items: { slug: string; name: string }[] }>('/products?page=1&pageSize=20');
  const products = MOCK_PRODUCTS;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">All Products</h1>
          <p className="mt-1 text-sm text-neutral-500">{products.length} items (mock data, ISR 60s)</p>
        </div>
        {/* 筛选器占位（组员 A）：分类 / 价格区间 / 属性 */}
        <div className="rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-500">
          Filters coming soon
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Link
            key={p.slug}
            href={`/products/${p.slug}`}
            className="group rounded-2xl border border-neutral-200 p-4 transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex aspect-square items-center justify-center rounded-xl bg-neutral-100 text-5xl group-hover:scale-105">
              ⚽
            </div>
            <h2 className="font-semibold group-hover:text-[var(--wm-primary)]">{p.name}</h2>
            <p className="mt-1 text-sm font-bold text-[var(--wm-primary)]">{p.price}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

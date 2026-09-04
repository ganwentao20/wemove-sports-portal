import Link from 'next/link';
import { notFound } from 'next/navigation';

/** PDP 路由参数 */
interface PageProps {
  params: Promise<{ slug: string }>;
}

// 静态生成演示（ISR）：与 PLP 的 MOCK 保持同源；接线 API 后改为 fetch 动态
const MOCK_PRODUCTS: Record<string, { name: string; description: string }> = {
  'strike-kids-bowling-set-6-pin': {
    name: 'Strike! Kids Bowling Set — 6 Pins',
    description:
      'Colorful 6-pin bowling set with soft balls — perfect indoor/outdoor active play for ages 3+.',
  },
  'balance-board-wooden-arc': {
    name: 'Wooden Balance Board — Arc',
    description: 'Sturdy wooden balance board that trains coordination and core strength.',
  },
  'ring-toss-outdoor-game-set': {
    name: 'Ring Toss Outdoor Game Set',
    description: 'Classic ring toss game set for garden parties and school play time.',
  },
};

/** SSR 演示路径生成（组员 A 接线真实目录后此函数可删） */
export function generateStaticParams() {
  return Object.keys(MOCK_PRODUCTS).map((slug) => ({ slug }));
}

/** 图集 / 规格 / 视频 / 横向对比入口（最多 4 款对比页 /compare）由组员 A 实现 */
export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = MOCK_PRODUCTS[slug];
  if (!product) notFound();

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-neutral-100 text-8xl">
        ⚽
      </div>
      <div>
        <nav className="text-xs text-neutral-400">
          <Link href="/products" className="hover:text-neutral-600">Products</Link> / {product.name}
        </nav>
        <h1 className="mt-3 text-3xl font-bold">{product.name}</h1>
        <p className="mt-3 text-neutral-600">{product.description}</p>
        <p className="mt-4 text-2xl font-bold text-[var(--wm-primary)]">$29.99</p>

        {/* 规格选择 / 加购 / 收藏 —— 组员 A（含库存与 B2C 购物车接口 MC） */}
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            Variant picker &amp; add-to-cart — next iteration (member A/C)
          </div>
        </div>
      </div>
    </div>
  );
}

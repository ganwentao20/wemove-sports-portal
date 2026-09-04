import Link from 'next/link';

/**
 * 首页（骨架）：模块占位 —— 正式内容由 CmsPage.home sections 驱动（组员 A 渲染 + 组员 D 后台配置）
 * SEO：本页为全站落地页，标题/描述继承根 layout。
 */
export default function HomePage() {
  return (
    <div>
      {/* Hero（骨架）：组员 A 替换为轮播/主视觉 */}
      <section className="bg-gradient-to-br from-[var(--wm-dark)] to-[#26313f] px-4 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm uppercase tracking-widest text-white/60">
            Active Play Toys · Since WEMOVE
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
            Get kids moving,
            <br />
            <span className="text-[var(--wm-primary)]">the fun way.</span>
          </h1>
          <p className="mt-4 max-w-xl text-white/75">
            Bowling sets, balance boards &amp; outdoor games for homes, schools and retailers worldwide.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-full bg-[var(--wm-primary)] px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Shop Products
            </Link>
            <Link
              href="/dealer/apply"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold hover:border-white"
            >
              Become a Dealer
            </Link>
          </div>
        </div>
      </section>

      {/* 模块化区域占位：Hero / 分类卡片 / 精选产品 / 品牌故事 —— 由 CMS sections 配置 */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold">Featured Collections</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Skeleton placeholder — wired to CMS modules in next iteration.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {['Kids Bowling', 'Balance & Coordination', 'Outdoor Throw Games'].map((name) => (
            <div
              key={name}
              className="rounded-2xl border border-neutral-200 p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-neutral-100 text-3xl">
                🎳
              </div>
              <h3 className="font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-neutral-500">Category module placeholder</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

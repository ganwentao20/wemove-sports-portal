import Image from "next/image";
import Link from "next/link";
import { CatalogVisual } from "../../components/catalog-visual";
import { serverApiGet } from "../../lib/server-api";

export const dynamic = "force-dynamic";

type ProductCard = {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  priceCents: number | null;
};
type ProductPage = { items: ProductCard[]; total: number };
type Category = {
  code: string;
  slug: string;
  name: string;
  productCount: number;
};

const FALLBACK_CATEGORIES: Category[] = [
  { code: "move", slug: "outdoor-play", name: "Move outside", productCount: 0 },
  { code: "balance", slug: "balance", name: "Build balance", productCount: 0 },
  { code: "together", slug: "group-games", name: "Play together", productCount: 0 },
];

export default async function HomePage() {
  const [productsResult, categoriesResult] = await Promise.all([
    serverApiGet<ProductPage>("/products?page=1&pageSize=4"),
    serverApiGet<Category[]>("/categories"),
  ]);
  const products = productsResult.ok ? productsResult.data.items : [];
  const liveCategories = categoriesResult.ok ? categoriesResult.data.slice(0, 3) : [];
  const categories = liveCategories.length > 0 ? liveCategories : FALLBACK_CATEGORIES;

  return (
    <div>
      <section className="px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:pb-16 lg:pt-16">
        <div className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-7xl items-center gap-10 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="wm-reveal max-w-xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--wm-primary)]">
              Active play, made thoughtful
            </p>
            <h1 className="text-5xl font-extrabold leading-[0.98] tracking-[-0.06em] text-[var(--wm-dark)] sm:text-6xl lg:text-7xl">
              Play starts with moving.
            </h1>
            <p className="mt-6 max-w-[36rem] text-base leading-7 text-[var(--wm-muted)] sm:text-lg">
              Thoughtful sports toys for confident movement at home, at school and outside.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="whitespace-nowrap rounded-xl bg-[var(--wm-primary)] px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--wm-primary-strong)] active:translate-y-0">
                Shop products
              </Link>
              <Link href="/dealer/apply" className="whitespace-nowrap rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-6 py-3.5 text-sm font-bold text-[var(--wm-text)] transition hover:-translate-y-0.5 hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)] active:translate-y-0">
                Become a dealer
              </Link>
            </div>
          </div>

          <div className="wm-reveal wm-reveal-delay relative min-h-[390px] overflow-hidden rounded-2xl bg-[#cfe2eb] shadow-[0_30px_80px_rgba(var(--wm-shadow)/0.18)] sm:min-h-[520px]">
            <Image src="/images/wemove-active-play-hero.png" alt="A collection of active play toys on an outdoor sports court" fill loading="eager" sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover object-center" />
            <span className="absolute inset-0 bg-gradient-to-r from-[#12324a]/10 via-transparent to-white/5" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 sm:px-6" aria-label="WEMOVE product principles">
        <div className="mx-auto grid max-w-7xl divide-y divide-[var(--wm-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["Built to move", "Toys that invite action, not more screen time."],
            ["Ready for real life", "Clear guidance for families, schools and retailers."],
            ["Made to play again", "Simple formats that stay fun beyond day one."],
          ].map(([title, copy]) => (
            <div key={title} className="px-2 py-7 sm:px-7">
              <h2 className="font-bold tracking-[-0.025em] text-[var(--wm-text)]">{title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-[var(--wm-muted)]">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-[var(--wm-dark)] sm:text-4xl">Find their kind of play</h2>
          <p className="mt-3 leading-7 text-[var(--wm-muted)]">Start with a movement, then discover the toys that make it feel natural.</p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <Link href={`/products?category=${encodeURIComponent(categories[0].slug)}`} className="group relative min-h-[420px] overflow-hidden rounded-2xl bg-[#cfe2eb] sm:min-h-[520px]">
            <div className="absolute inset-0">
              <CatalogVisual name={categories[0].name} className="h-full w-full" />
            </div>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102332]/90 to-transparent px-6 pb-7 pt-24 text-white sm:px-8">
              <span className="block text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">{categories[0].name}</span>
              <span className="mt-2 block text-sm text-white/80">
                {categories[0].productCount > 0 ? `${categories[0].productCount} products` : "Explore the collection"}
              </span>
            </span>
          </Link>

          <div className="border-t border-[var(--wm-border)]">
            {categories.slice(1).map((category, index) => (
              <Link key={category.code} href={`/products?category=${encodeURIComponent(category.slug)}`} className="group grid grid-cols-[88px_1fr_auto] items-center gap-5 border-b border-[var(--wm-border)] py-6 sm:grid-cols-[112px_1fr_auto]">
                <CatalogVisual name={`${category.name}-${index}`} className="aspect-square rounded-2xl" />
                <span>
                  <span className="block text-lg font-bold tracking-[-0.025em] text-[var(--wm-text)] group-hover:text-[var(--wm-primary)]">{category.name}</span>
                  <span className="mt-1 block text-sm text-[var(--wm-muted)]">
                    {category.productCount > 0 ? `${category.productCount} products` : "Explore the collection"}
                  </span>
                </span>
                <span className="text-lg text-[var(--wm-muted)] transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </Link>
            ))}
            <Link href="/products" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[var(--wm-primary)] hover:text-[var(--wm-primary-strong)]">
              View every product <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {products.length > 0 && (
        <section className="bg-[var(--wm-surface)] px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-[var(--wm-dark)]">Ready for the next game</h2>
            <div className="mt-9 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.slug}`} className="group">
                  <CatalogVisual name={product.name} className="aspect-[4/5] rounded-2xl" />
                  <h3 className="mt-4 font-bold tracking-[-0.02em] group-hover:text-[var(--wm-primary)]">{product.name}</h3>
                  {product.summary && <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--wm-muted)]">{product.summary}</p>}
                  <p className="mt-3 text-sm font-extrabold text-[var(--wm-primary)]">
                    {product.priceCents === null ? "Contact us" : `From $${(product.priceCents / 100).toFixed(2)}`}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid items-end gap-8 border-t border-[var(--wm-border)] pt-12 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-[var(--wm-dark)] sm:text-4xl">Bring better play to your shelves.</h2>
            <p className="mt-3 leading-7 text-[var(--wm-muted)]">Dealer access, product resources and ordering tools in one practical place.</p>
          </div>
          <Link href="/dealer/apply" className="w-full whitespace-nowrap rounded-xl bg-[var(--wm-dark)] px-6 py-3.5 text-center text-sm font-bold text-[var(--wm-surface)] transition hover:-translate-y-0.5 active:translate-y-0 sm:w-auto">
            Apply for dealer access
          </Link>
        </div>
      </section>
    </div>
  );
}

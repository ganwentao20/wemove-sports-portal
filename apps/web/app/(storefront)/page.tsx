import Link from "next/link";
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

export default async function HomePage() {
  const [productsResult, categoriesResult] = await Promise.all([
    serverApiGet<ProductPage>("/products?page=1&pageSize=6"),
    serverApiGet<Category[]>("/categories"),
  ]);
  const products = productsResult.ok ? productsResult.data.items : [];
  const categories = categoriesResult.ok
    ? categoriesResult.data.slice(0, 6)
    : [];

  return (
    <div>
      <section className="bg-gradient-to-br from-[var(--wm-dark)] to-[#26313f] px-4 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm uppercase tracking-widest text-white/60">
            Active Play Toys · WEMOVE SPORTS
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
            Get kids moving,
            <br />
            <span className="text-[var(--wm-primary)]">the fun way.</span>
          </h1>
          <p className="mt-4 max-w-xl text-white/75">
            Bowling sets, balance boards and outdoor games for homes, schools
            and retailers worldwide.
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

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Shop by category</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Explore active play collections from the live catalog.
            </p>
          </div>
          <Link
            href="/products"
            className="text-sm font-semibold text-[var(--wm-primary)]"
          >
            View all
          </Link>
        </div>
        {categories.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.code}
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="rounded-2xl border border-neutral-200 p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-neutral-100 text-3xl">
                  🎳
                </div>
                <h3 className="font-semibold">{category.name}</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {category.productCount} products
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed p-6 text-sm text-neutral-500">
            Categories will appear when the catalog service is available.
          </p>
        )}
      </section>

      {products.length > 0 && (
        <section className="bg-neutral-50 px-4 py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold">Featured products</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-36 items-center justify-center rounded-xl bg-neutral-100 text-5xl">
                    ⚽
                  </div>
                  <h3 className="font-semibold">{product.name}</h3>
                  {product.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                      {product.summary}
                    </p>
                  )}
                  <p className="mt-3 text-sm font-bold text-[var(--wm-primary)]">
                    {product.priceCents === null
                      ? "Contact us"
                      : `From $${(product.priceCents / 100).toFixed(2)}`}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

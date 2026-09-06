import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogVisual } from "../../../../components/catalog-visual";
import { serverApiGet } from "../../../../lib/server-api";
import { ProductPurchase } from "./product-purchase";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  ageGuidance: string | null;
  gallery: unknown;
  resources: unknown;
  category: { slug: string; name: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    name: string | null;
    attrs: unknown;
    price: { priceCents: number; source: "SALE" | "MSRP" } | null;
  }>;
};

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.startsWith("/media/")) return `/api/v1${value}`;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return /^https?:\/\//i.test(value) ? value : null;
}

function imageFromGallery(gallery: unknown) {
  if (!Array.isArray(gallery)) return null;
  for (const item of gallery) {
    const url = safeUrl(
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? (item as Record<string, unknown>).url
          : null,
    );
    if (url) return url;
  }
  return null;
}

function publicResources(resources: unknown) {
  if (!Array.isArray(resources)) return [];
  return resources.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const url = safeUrl(row.url);
    if (!url) return [];
    return [
      {
        label:
          typeof row.label === "string" && row.label.trim()
            ? row.label
            : `Resource ${index + 1}`,
        url,
        type: typeof row.type === "string" ? row.type : "Resource",
      },
    ];
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await serverApiGet<ProductDetail>(
    `/products/${encodeURIComponent(slug)}`,
  );
  if (!result.ok) return { title: "Product" };
  return {
    title: result.data.name,
    description: result.data.summary ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await serverApiGet<ProductDetail>(
    `/products/${encodeURIComponent(slug)}`,
  );
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--wm-primary)]">Catalog update</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.045em]">Product unavailable</h1>
        <p className="mt-3 text-[var(--wm-muted)]">{result.message}</p>
        <Link href="/products" className="mt-7 inline-flex rounded-xl bg-[var(--wm-dark)] px-5 py-3 text-sm font-bold text-[var(--wm-surface)]">Back to products</Link>
      </div>
    );
  }
  const product = result.data;
  const imageUrl = imageFromGallery(product.gallery);
  const resources = publicResources(product.resources);

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
      <CatalogVisual name={product.name} imageUrl={imageUrl} priority className="aspect-square rounded-2xl shadow-[0_24px_70px_rgba(var(--wm-shadow)/0.12)]" />
      <div>
        <nav className="text-xs font-semibold text-[var(--wm-muted)]">
          <Link href="/products" className="hover:text-[var(--wm-primary)]">
            Products
          </Link>
          {product.category ? ` / ${product.category.name}` : ""} /{" "}
          {product.name}
        </nav>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.05em] text-[var(--wm-dark)] sm:text-5xl">{product.name}</h1>
        {product.summary && (
          <p className="mt-4 text-lg leading-7 text-[var(--wm-muted)]">{product.summary}</p>
        )}
        {product.description && (
          <div className="mt-6 whitespace-pre-line border-t border-[var(--wm-border)] pt-6 text-sm leading-7 text-[var(--wm-text)]">
            {product.description}
          </div>
        )}
        {product.ageGuidance && (
          <aside className="mt-6 rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface-soft)] p-5 text-sm leading-6 text-[var(--wm-text)]">
            <strong>Age &amp; supervision guidance:</strong>{" "}
            {product.ageGuidance}
          </aside>
        )}
        <ProductPurchase
          productSlug={product.slug}
          variants={product.variants}
        />
        <Link
          href={`/compare?ids=${encodeURIComponent(product.slug)}`}
          className="mt-3 inline-flex rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-5 py-2.5 text-sm font-bold hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]"
        >
          Add to comparison
        </Link>
        {resources.length > 0 && (
          <section className="mt-6">
            <h2 className="font-bold">Product resources</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {resources.map((resource) => (
                <li key={`${resource.url}-${resource.label}`}>
                  <a
                    href={resource.url}
                    className="font-semibold text-[var(--wm-primary)] underline underline-offset-4"
                  >
                    {resource.label}
                  </a>{" "}
                  <span className="text-[var(--wm-muted)]">({resource.type})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

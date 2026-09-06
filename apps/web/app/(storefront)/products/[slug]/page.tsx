import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-2xl font-bold">Product unavailable</h1>
        <p className="mt-3 text-neutral-600">{result.message}</p>
      </div>
    );
  }
  const product = result.data;
  const imageUrl = imageFromGallery(product.gallery);
  const resources = publicResources(product.resources);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-neutral-100 text-8xl">
        {imageUrl ? (
          // Product media URLs are managed by the catalog CMS and may be API-relative.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-label="Product image placeholder" role="img">
            ⚽
          </span>
        )}
      </div>
      <div>
        <nav className="text-xs text-neutral-400">
          <Link href="/products" className="hover:text-neutral-600">
            Products
          </Link>
          {product.category ? ` / ${product.category.name}` : ""} /{" "}
          {product.name}
        </nav>
        <h1 className="mt-3 text-3xl font-bold">{product.name}</h1>
        {product.summary && (
          <p className="mt-3 text-neutral-600">{product.summary}</p>
        )}
        {product.description && (
          <div className="mt-5 whitespace-pre-line text-sm leading-6 text-neutral-700">
            {product.description}
          </div>
        )}
        {product.ageGuidance && (
          <aside className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
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
          className="mt-3 inline-flex rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold hover:border-[#2B5F8A]"
        >
          Add to comparison
        </Link>
        {resources.length > 0 && (
          <section className="mt-6">
            <h2 className="font-semibold">Product resources</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {resources.map((resource) => (
                <li key={`${resource.url}-${resource.label}`}>
                  <a
                    href={resource.url}
                    className="font-medium text-[#2B5F8A] underline underline-offset-4"
                  >
                    {resource.label}
                  </a>{" "}
                  <span className="text-neutral-400">({resource.type})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

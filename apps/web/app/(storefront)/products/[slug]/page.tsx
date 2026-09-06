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
  category: { slug: string; name: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    name: string | null;
    attrs: unknown;
    price: { priceCents: number; source: "SALE" | "MSRP" } | null;
  }>;
};

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

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-neutral-100 text-8xl">
        ⚽
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
        <ProductPurchase
          productSlug={product.slug}
          variants={product.variants}
        />
      </div>
    </div>
  );
}

import {
  ProductRating,
  ratingStructuredData,
  type RatingSummary,
} from "../../../../components/product-rating";
import { cookies } from "next/headers";
import {
  ProductDownloads,
  type ProductFile,
} from "../../../../components/product-downloads";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { productCopy, productPageLanguage } from "../../../../lib/product-copy";
import { serverApiGet } from "../../../../lib/server-api";
import { ProductPurchase } from "./product-purchase";
import { DealerProductPurchase } from "../../../../components/dealer-product-purchase";
import { ProductGallery } from "../../../../components/product-gallery";
import { WishlistButton } from "../../../../components/wishlist-button";
import { ProductSelectionProvider } from "../../../../components/product-selection";
import { ShareLink } from "../../../../components/share-link";
import { getLocale, getMarket, SITE_URL } from "../../../../lib/locale";
import { contentText } from "../../../../lib/content-text";
import { publicUrl } from "../../../../lib/public-url";
import ProductsPage from "../page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type ProductDetail = {
  rating: RatingSummary | null;
  locale: string;
  publishedLanguages: string[];
  indexableLanguages: string[];
  seo: Record<string, string | boolean>;
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  ageGuidance: string | null;
  gallery: unknown;
  currency: string;
  retailEnabled: boolean;
  ageMin: number | null;
  ageMax: number | null;
  scenes: string[];
  skills: string[];
  tags: string[];
  tagLabels?: Record<string, string>;
  sceneLabels?: Record<string, string>;
  skillLabels?: Record<string, string>;
  specifications: Record<string, unknown>;
  playGuide: string | null;
  productFaq: Array<{ question: string; answer: string }>;
  relatedProducts: Array<{ id: string; name: string; slug: string }>;
  accessories: Array<{ id: string; name: string; slug: string }>;
  replacements: Array<{ id: string; name: string; slug: string }>;
  resources: unknown;
  category: { slug: string; name: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    name: string | null;
    attrs: unknown;
    price: { priceCents: number; source: "SALE" | "MSRP" } | null;
    availability: string;
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

function publicResources(resources: unknown, locale: string) {
  const copy = productCopy(locale);
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
            : `${copy.resource} ${index + 1}`,
        url,
        type: typeof row.type === "string" ? row.type : copy.resource,
      },
    ];
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale(),
    market = await getMarket();
  const result = await serverApiGet<ProductDetail>(
    `/products/${encodeURIComponent(slug)}?market=${market}&locale=${locale}`,
  );
  if (!result.ok) return { title: productCopy(locale).products };
  const seo = result.data.seo ?? {},
    fallback = `${SITE_URL}/${result.data.locale}/products/${slug}?market=${market}`;
  const canonical =
    typeof seo.canonical === "string" && seo.canonical
      ? new URL(seo.canonical, SITE_URL).href
      : fallback;
  return {
    title: String(seo.title || result.data.name),
    description: String(seo.description || result.data.summary || ""),
    robots: {
      index:
        process.env.DEPLOYMENT_ENV === "production" &&
        seo.noindex !== true &&
        !String(seo.robots ?? "").includes("noindex"),
      follow: !String(seo.robots ?? "").includes("nofollow"),
    },
    openGraph: {
      title: String(seo.ogTitle || seo.title || result.data.name),
      description: String(
        seo.ogDescription || seo.description || result.data.summary || "",
      ),
      ...(seo.ogImage
        ? { images: [new URL(String(seo.ogImage), SITE_URL).href] }
        : {}),
    },
    alternates: {
      canonical,
      languages: Object.fromEntries(
        result.data.indexableLanguages
          .filter((lang) => productPageLanguage(lang))
          .map((lang) => [
            lang,
            `${SITE_URL}/${lang}/products/${slug}?market=${market}`,
          ]),
      ),
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale(),
    market = await getMarket();
  if (!productPageLanguage(locale))
    redirect(`/en/products/${encodeURIComponent(slug)}?market=${market}`);
  const copy = productCopy(locale);
  const result = await serverApiGet<ProductDetail>(
    `/products/${encodeURIComponent(slug)}?market=${market}&locale=${locale}`,
  );
  if (!result.ok && result.status === 404) {
    const categories = await serverApiGet<Array<{ slug: string }>>(
      `/categories?market=${market}&locale=${locale}`,
    );
    if (categories.ok && categories.data.some((item) => item.slug === slug)) {
      return ProductsPage({
        searchParams: Promise.resolve({ category: slug, market }),
      });
    }
    notFound();
  }
  if (result.ok && result.data.locale !== locale)
    redirect(
      `/${result.data.locale}/products/${encodeURIComponent(slug)}?market=${market}`,
    );
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--wm-primary)]">
          {copy.catalogUpdate}
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.045em]">
          {copy.unavailable}
        </h1>
        <p className="mt-3 text-[var(--wm-muted)]">{copy.notAvailable}</p>
        <Link
          href={`/${locale}/products?market=${market}`}
          className="mt-7 inline-flex rounded-xl bg-[var(--wm-dark)] px-5 py-3 text-sm font-bold text-[var(--wm-surface)]"
        >
          {copy.back}
        </Link>
      </div>
    );
  }
  const product = result.data;
  const jar = await cookies(),
    downloadKind = jar.has("wm_dealer_session")
      ? "dealer"
      : jar.has("wm_customer_session")
        ? "customer"
        : null;
  const mediaResources = await serverApiGet<ProductFile[]>(
    "/media/public?productId=" + encodeURIComponent(product.id),
  );
  const globalQuestions = await serverApiGet<
    Array<{
      title: string;
      locale: string;
      sections: unknown;
      productIds: string[];
    }>
  >(`/cms/pages?kind=FAQ&locale=${product.locale}&market=${market}`);
  const questions = [
    ...product.productFaq,
    ...(globalQuestions.ok
      ? globalQuestions.data
          .filter(
            (q) =>
              q.locale === product.locale &&
              (!q.productIds.length || q.productIds.includes(product.id)),
          )
          .map((q) => ({ question: q.title, answer: contentText(q.sections) }))
      : []),
  ];
  const uniqueQuestions = [
    ...new Map(questions.map((q) => [q.question, q])).values(),
  ];
  const imageUrl = imageFromGallery(product.gallery);
  const resources = publicResources(product.resources, product.locale);
  const specifications = Object.entries(product.specifications ?? {}).filter(
    ([key, value]) =>
      key !== "translations" &&
      ["string", "number", "boolean"].includes(typeof value),
  );
  const canonical =
    typeof product.seo?.canonical === "string" && product.seo.canonical
      ? new URL(product.seo.canonical, SITE_URL).href
      : `${SITE_URL}/${product.locale}/products/${slug}?market=${market}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary,
    image: imageUrl ?? undefined,
    url: canonical,
    ...(product.rating
      ? { aggregateRating: ratingStructuredData(product.rating) }
      : {}),
    offers: product.variants
      .filter((v) => v.price)
      .map((v) => ({
        "@type": "Offer",
        sku: v.sku,
        price: (v.price!.priceCents / 100).toFixed(2),
        priceCurrency: product.currency,
        availability: `https://schema.org/${v.availability === "IN_STOCK" ? "InStock" : v.availability === "PREORDER" ? "PreOrder" : v.availability === "BACKORDER" ? "BackOrder" : "OutOfStock"}`,
        url: canonical,
      })),
  };
  const structuredData = [
    schema,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: copy.products,
          item: `${SITE_URL}/${product.locale}/products?market=${market}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: product.name,
          item: canonical,
        },
      ],
    },
    ...(uniqueQuestions.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: uniqueQuestions.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          },
        ]
      : []),
  ];

  return (
    <ProductSelectionProvider variants={product.variants}>
      <div
        lang={product.locale}
        data-product-id={product.id}
        data-availability={
          product.variants.some((v) => v.availability === "IN_STOCK")
            ? "IN_STOCK"
            : product.variants.some(
                  (v) => v.availability === "CHECK_AVAILABILITY",
                )
              ? "CHECK_AVAILABILITY"
              : "OUT_OF_STOCK"
        }
        className="wm-original-product mx-auto grid max-w-[1600px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-16"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <ProductGallery
          locale={product.locale}
          name={product.name}
          gallery={product.gallery}
        />
        <div>
          <nav className="text-sm font-normal text-[#777]">
            <Link
              href={`/${locale}/products?market=${market}`}
              className="hover:text-[var(--wm-primary)]"
            >
              {copy.products}
            </Link>
            {product.category ? ` / ${product.category.name}` : ""} /{" "}
            {product.name}
          </nav>
          <h1 className="mt-6 border-b border-[#deded8] pb-6 text-4xl font-normal leading-tight tracking-[-0.035em] text-[#333] sm:text-5xl">
            {product.name}
          </h1>
          <ProductRating rating={product.rating} locale={product.locale} />
          <div className="mt-3 flex flex-wrap gap-2">
            {product.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold"
              >
                {product.tagLabels?.[tag] ?? tag}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-neutral-600">
            {product.ageMin !== null
              ? `${copy.ages} ${
                  product.ageMax === null
                    ? `${product.ageMin}+`
                    : `${product.ageMin}–${product.ageMax}`
                } · `
              : ""}
            {product.scenes
              ?.map((scene) => product.sceneLabels?.[scene] ?? scene)
              .join(", ")}
            {product.skills?.length
              ? ` · ${product.skills.map((skill) => product.skillLabels?.[skill] ?? skill).join(", ")}`
              : ""}
          </p>
          {product.summary && (
            <p className="mt-6 text-lg leading-8 text-[#676b67]">
              {product.summary}
            </p>
          )}
          {product.description && (
            <div className="mt-8 whitespace-pre-line border-t border-[#deded8] pt-7 text-base leading-8 text-[#444]">
              {product.description}
            </div>
          )}
          {product.ageGuidance && (
            <aside className="mt-6 rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface-soft)] p-5 text-sm leading-6 text-[var(--wm-text)]">
              <strong>{copy.guidance}:</strong> {product.ageGuidance}
            </aside>
          )}
          <DealerProductPurchase
            locale={product.locale}
            productId={product.id}
            productSlug={product.slug}
            productName={product.name}
            market={market}
          >
            <ProductPurchase
              locale={product.locale}
              productId={product.id}
              market={market}
              productSlug={product.slug}
              variants={product.variants}
              retailEnabled={product.retailEnabled}
              currency={product.currency}
            />
          </DealerProductPurchase>
          <Link
            href={publicUrl(
              `/compare?ids=${encodeURIComponent(product.slug)}`,
              locale,
              market,
            )}
            className="mt-3 inline-flex rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-5 py-2.5 text-sm font-bold hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]"
          >
            {copy.compare}
          </Link>
          <div className="mt-3">
            <ShareLink
              locale={product.locale}
              url={canonical}
              title={product.name}
            />
            <WishlistButton
              locale={product.locale}
              market={market}
              productId={product.id}
            />
          </div>
          <ProductDownloads
            productId={product.id}
            slug={product.slug}
            locale={product.locale}
            market={market}
            initial={mediaResources.ok ? mediaResources.data : []}
            kind={downloadKind}
          />
          {resources.length > 0 && (
            <section className="mt-6">
              <h2 className="font-bold">{copy.resources}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {resources.map((resource) => (
                  <li key={`${resource.url}-${resource.label}`}>
                    <a
                      href={resource.url}
                      className="font-semibold text-[var(--wm-primary)] underline underline-offset-4"
                    >
                      {resource.label}
                    </a>{" "}
                    <span className="text-[var(--wm-muted)]">
                      ({resource.type})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {specifications.length > 0 && (
            <section className="mt-7">
              <h2 className="text-xl font-bold">{copy.specifications}</h2>
              <dl className="mt-3 divide-y rounded-xl border px-4">
                {specifications.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between gap-5 py-3 text-sm"
                  >
                    <dt>{key}</dt>
                    <dd className="font-semibold">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {product.playGuide && (
            <section className="mt-7">
              <h2 className="text-xl font-bold">{copy.play}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7">
                {product.playGuide}
              </p>
            </section>
          )}
          {uniqueQuestions.length > 0 && (
            <section className="mt-7">
              <h2 className="text-xl font-bold">{copy.faq}</h2>
              {uniqueQuestions
                .filter(
                  (f) =>
                    typeof f.question === "string" &&
                    typeof f.answer === "string",
                )
                .map((f, index) => (
                  <details key={index} className="mt-3 rounded-xl border p-4">
                    <summary className="cursor-pointer font-semibold">
                      {f.question}
                    </summary>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6">
                      {f.answer}
                    </p>
                  </details>
                ))}
            </section>
          )}
          {(
            [
              { key: "related", items: product.relatedProducts },
              { key: "accessories", items: product.accessories },
              { key: "replacements", items: product.replacements },
            ] as const
          ).map(
            (group) =>
              group.items?.length > 0 && (
                <section
                  key={group.key}
                  className="mt-7"
                  data-association-type={group.key}
                >
                  <h2 className="text-xl font-bold">{copy[group.key]}</h2>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {group.items.map((p) => (
                      <Link
                        className="rounded-xl border px-4 py-3 text-sm font-semibold"
                        key={p.id}
                        href={`/${product.locale}/products/${p.slug}?market=${market}`}
                      >
                        {p.name}
                      </Link>
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      </div>
    </ProductSelectionProvider>
  );
}

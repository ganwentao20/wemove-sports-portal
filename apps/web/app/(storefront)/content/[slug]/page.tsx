import { getUiText } from "../../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentCollection } from "../../../../components/content-collection";
import { ContentBlocks } from "../../../../components/content-blocks";
import { serverApiGet } from "../../../../lib/server-api";
import { getLocale, getMarket, SITE_URL } from "../../../../lib/locale";
import { contentPath } from "../../../../lib/content-path";
export const dynamic = "force-dynamic";
type Page = {
  id: string;
  slug: string;
  title: string;
  sections: unknown;
  locale: string;
  kind: string;
  productIds: string[];
  indexableLanguages: string[];
  author?: string;
  seo?: Record<string, string | boolean>;
  createdAt: string;
  updatedAt: string;
  translations: Record<string, { status?: string }>;
};
async function read(slug: string) {
  const locale = await getLocale(),
    market = await getMarket();
  return serverApiGet<Page>(
    "/cms/pages/" +
      encodeURIComponent(slug) +
      "?locale=" +
      locale +
      "&market=" +
      market,
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const t = await getUiText();
  const { slug } = await params,
    result = await read(slug);
  if (!result.ok)
    return { title: t("Content unavailable"), robots: { index: false } };
  const p = result.data,
    seo = p.seo ?? {},
    market = await getMarket(),
    path = contentPath(p.slug),
    url = (locale: string) =>
      SITE_URL +
      "/" +
      locale +
      (path === "/" ? "" : path) +
      "?market=" +
      market;
  return {
    title: String(seo.title ?? p.title),
    description: String(seo.description ?? ""),
    robots: {
      index:
        process.env.DEPLOYMENT_ENV === "production" &&
        seo.noindex !== true &&
        !String(seo.robots ?? "").includes("noindex"),
    },
    alternates: {
      canonical: String(seo.canonical ?? url(p.locale)),
      languages: Object.fromEntries(
        p.indexableLanguages
          .filter((language) =>
            ["en", "zh", "fr", "de"].includes(language.split("-")[0]),
          )
          .map((locale) => [locale, url(locale)]),
      ),
    },
    openGraph: {
      title: String(seo.ogTitle ?? p.title),
      description: String(seo.ogDescription ?? seo.description ?? ""),
      ...(seo.ogImage ? { images: [String(seo.ogImage)] } : {}),
    },
  };
}
export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getUiText();
  const { slug } = await params,
    result = await read(slug);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold">
          {t("Content temporarily unavailable")}
        </h1>
        <p className="mt-4" role="status">
          {t("Please try again shortly.")}
        </p>
      </div>
    );
  }
  const p = result.data,
    requested = await getLocale();
  const schema = {
    "@context": "https://schema.org",
    "@type": p.kind === "ARTICLE" ? "Article" : "WebPage",
    headline: p.title,
    datePublished: p.createdAt,
    dateModified: p.updatedAt,
    inLanguage: p.locale,
    ...(p.author ? { author: { "@type": "Person", name: p.author } } : {}),
  };
  return (
    <div lang={p.locale} className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {p.locale !== requested && (
        <p role="status" className="mb-6 rounded-xl border p-4">
          {t(
            "This content is available in English while its translation is being prepared.",
          )}
        </p>
      )}
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight">{p.title}</h1>
        {p.author && (
          <p className="mt-3 text-sm text-neutral-600">
            {p.author} · {new Date(p.updatedAt).toLocaleDateString(p.locale)}
          </p>
        )}
      </header>
      <ContentBlocks sections={p.sections} locale={p.locale} />
      {p.productIds?.length > 0 && (
        <div className="mt-10">
          <ContentCollection
            type="products"
            locale={p.locale}
            props={{
              id: "associated-products",
              title:
                (
                  {
                    zh: "相关产品",
                    fr: "Produits associés",
                    de: "Zugehörige Produkte",
                  } as Record<string, string>
                )[p.locale.split("-")[0]] ?? "Related products",
              productIds: p.productIds,
              limit: 24,
            }}
          />
        </div>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replaceAll("<", "\\u003c"),
        }}
      />
    </div>
  );
}

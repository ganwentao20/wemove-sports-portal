import {
  sitemapConfig,
  sitemapEntries,
  siteMapUrl,
} from "../../../../lib/sitemap-data";
export const dynamic = "force-dynamic";
const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ market: string; locale: string }> },
) {
  const { market, locale: raw } = await params,
    locale = raw.replace(/\.xml$/, ""),
    config = await sitemapConfig();
  if (!config.markets.includes(market) || !config.languages.includes(locale))
    return new Response("Not found", { status: 404 });
  const items = await sitemapEntries(market, locale);
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${items.map((item) => `<url><loc>${xml(siteMapUrl(item))}</loc>${item.lastModified ? `<lastmod>${item.lastModified}</lastmod>` : ""}${item.languages.map((language) => `<xhtml:link rel="alternate" hreflang="${language}" href="${xml(siteMapUrl(item, language))}"/>`).join("")}</url>`).join("")}</urlset>`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

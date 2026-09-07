import type { MetadataRoute } from "next";
import { sitemapConfig, sitemapEntries, siteMapUrl } from "../lib/sitemap-data";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await sitemapConfig(),
    routes: MetadataRoute.Sitemap = [];
  for (const market of config.markets)
    for (const locale of config.languages)
      for (const item of await sitemapEntries(market, locale))
        routes.push({
          url: siteMapUrl(item),
          lastModified: item.lastModified,
          alternates: {
            languages: Object.fromEntries(
              item.languages.map((language) => [
                language,
                siteMapUrl(item, language),
              ]),
            ),
          },
        });
  return routes;
}

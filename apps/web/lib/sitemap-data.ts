import { serverApiGet } from "./server-api";
import { SITE_URL } from "./locale";
export type SitemapItem = {
  path: string;
  locale: string;
  market: string;
  languages: string[];
  lastModified?: string;
};
export function siteMapUrl(item: SitemapItem, language = item.locale) {
  const url = new URL(
    `${SITE_URL}/${language}${item.path === "/" ? "" : item.path}`,
  );
  url.searchParams.set("market", item.market);
  return url.href;
}
export async function sitemapConfig() {
  const result = await serverApiGet<{ languages: string[]; markets: string[] }>(
    "/site/sitemaps/config",
  );
  return result.ok ? result.data : { languages: ["en"], markets: ["US"] };
}
export async function sitemapEntries(market: string, locale: string) {
  const entries: SitemapItem[] = [];
  for (let page = 1; ; page++) {
    const result = await serverApiGet<{
      items: SitemapItem[];
      total: number;
      pageSize: number;
    }>(`/site/sitemaps?market=${market}&locale=${locale}&page=${page}`);
    if (!result.ok) break;
    entries.push(...result.data.items);
    if (page * result.data.pageSize >= result.data.total) break;
  }
  return entries;
}

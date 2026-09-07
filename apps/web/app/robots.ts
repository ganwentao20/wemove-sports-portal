import type { MetadataRoute } from "next";
import { sitemapConfig } from "../lib/sitemap-data";

/**
 * 全站 robots.txt（SEO 基础项，组员 A/D 上线前核对正式域名）
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (process.env.DEPLOYMENT_ENV !== "production")
    return { rules: { userAgent: "*", disallow: "/" } };
  const config = await sitemapConfig();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wemovetoy.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/customer/",
        "/dealer/",
        "/admin/",
        "/api/",
        "/en/customer/",
        "/zh/customer/",
        "/en/dealer/",
        "/zh/dealer/",
        "/en/admin/",
        "/zh/admin/",
      ],
    },
    sitemap: [
      `${base}/sitemap.xml`,
      ...config.markets.flatMap((market) =>
        config.languages.map(
          (locale) => `${base}/sitemaps/${market}/${locale}.xml`,
        ),
      ),
    ],
  };
}

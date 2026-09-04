import type { MetadataRoute } from 'next';

/**
 * 全站 robots.txt（SEO 基础项，组员 A/D 上线前核对正式域名）
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/customer/', '/dealer/', '/admin/', '/api/'],
    },
    sitemap: 'https://www.wemovetoy.com/sitemap.xml',
  };
}

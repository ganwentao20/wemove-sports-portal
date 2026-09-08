import { LANGUAGE_CODE } from './locale-policy.js';
import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min, Max } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicProductWhere } from '../catalog/catalog.service.js';
import { indexableProductLanguages } from '../catalog/product-locales.js';
import {
  visibleContentWhere,
  indexablePageLanguages,
} from '../cms/content-policy.js';
import { readLocalePolicy } from './locale-policy.js';
class SitemapQuery {
  @IsOptional() @Matches(/^[A-Z]{2}$/) market = 'US';
  @IsOptional() @Matches(LANGUAGE_CODE) locale = 'en';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
}
@Controller('site/sitemaps')
export class SeoMapController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('config') async config() {
    const policy = await readLocalePolicy(this.prisma);
    const markets = await this.prisma.retailMarket.findMany({
      select: { code: true },
      orderBy: { code: 'asc' },
    });
    return {
      languages: policy.languages,
      markets: markets.length ? markets.map((m) => m.code) : ['US'],
    };
  }
  @Get() async entries(@Query() query: SitemapQuery) {
    const policy = await readLocalePolicy(this.prisma),
      { market, locale } = query;
    if (!policy.languages.includes(locale))
      return { items: [], total: 0, page: query.page, pageSize: 1000 };
    const [products, pages] = await Promise.all([
      this.prisma.product.findMany({
        where: publicProductWhere(market),
        select: {
          slug: true,
          specifications: true,
          description: true,
          ageGuidance: true,
          playGuide: true,
          productFaq: true,
          seo: true,
          updatedAt: true,
        },
      }),
      this.prisma.cmsPage.findMany({
        where: {
          ...visibleContentWhere(market),
          kind: { notIn: ['BANNER', 'NAVIGATION'] },
        },
        select: {
          slug: true,
          locale: true,
          translations: true,
          seo: true,
          updatedAt: true,
        },
      }),
    ]);
    type Item = {
      path: string;
      locale: string;
      market: string;
      languages: string[];
      lastModified?: string;
    };
    const items: Item[] = [];
    if (locale === 'en')
      for (const path of [
        '/',
        '/products',
        '/play-learn',
        '/support',
        '/support/faq',
        '/support/downloads',
        '/contact',
        '/dealers',
      ])
        items.push({ path, locale, market, languages: ['en'] });
    for (const p of products) {
      const languages = indexableProductLanguages(p).filter(
        (language) =>
          policy.languages.includes(language) &&
          ['en', 'zh', 'fr', 'de'].includes(language.split('-')[0]),
      );
      if (languages.includes(locale))
        items.push({
          path: `/products/${p.slug}`,
          locale,
          market,
          languages,
          lastModified: p.updatedAt.toISOString(),
        });
    }
    for (const p of pages) {
      const languages = indexablePageLanguages(p).filter(
        (language) =>
          policy.languages.includes(language) &&
          ['en', 'zh', 'fr', 'de'].includes(language.split('-')[0]),
      );
      if (!languages.includes(locale)) continue;
      const path =
        p.slug === 'home'
          ? '/'
          : ['about', 'privacy', 'terms', 'quality-safety'].includes(p.slug)
            ? `/${p.slug}`
            : `/content/${p.slug}`;
      items.push({
        path,
        locale,
        market,
        languages,
        lastModified: p.updatedAt.toISOString(),
      });
    }
    if (locale === 'en') {
      const categories = await this.prisma.productCategory.findMany({
        where: { active: true },
        select: { slug: true, seo: true, updatedAt: true },
      });
      for (const category of categories) {
        const seo = category.seo as Record<string, unknown> | null;
        if (!seo?.noindex && !String(seo?.robots ?? '').includes('noindex'))
          items.push({
            path: '/products?category=' + encodeURIComponent(category.slug),
            locale,
            market,
            languages: ['en'],
            lastModified: category.updatedAt.toISOString(),
          });
      }
    }
    if (locale === 'en') {
      const dealers = await this.prisma.dealerCompany.findMany({
        where: {
          status: 'APPROVED',
          country: market,
          profile: {
            path: ['directoryPublished', 'publicListing'],
            equals: true,
          },
        },
        select: { id: true, profile: true, updatedAt: true },
      });
      for (const dealer of dealers) {
        const published = (dealer.profile as Record<string, any>)
          .directoryPublished;
        if (
          published.publicDetail === true &&
          typeof published.publicDescription === 'string' &&
          published.publicDescription.trim().length >= 100
        )
          items.push({
            path: `/dealers/${dealer.id}`,
            locale: 'en',
            market,
            languages: ['en'],
            lastModified: dealer.updatedAt.toISOString(),
          });
      }
    }
    const unique = [
      ...new Map(items.map((item) => [item.path, item])).values(),
    ].sort((a, b) => a.path.localeCompare(b.path));
    return {
      items: unique.slice((query.page - 1) * 1000, query.page * 1000),
      total: unique.length,
      page: query.page,
      pageSize: 1000,
    };
  }
}

import { publishedRating } from './rating-policy.js';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPaged } from '../common/pagination.dto.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { resolveRetailPrice } from '../pricing/pricing-engine.js';
import { DEFAULT_MARKET } from '../order/commerce.service.js';
import { inventoryAvailability } from '../order/inventory.service.js';
import { readLocalePolicy } from '../platform/locale-policy.js';
import {
  publishedProductLanguages,
  productSeoForLanguage,
  indexableProductLanguages,
} from './product-locales.js';
import { galleryFor } from './gallery-policy.js';
export { publishedProductLanguages } from './product-locales.js';
import type { CatalogQueryDto } from './dto/catalog.dto.js';

export function publicProductWhere(market = 'US'): Prisma.ProductWhereInput {
  const now = new Date();
  return {
    status: { in: ['ACTIVE', 'SCHEDULED'] },
    AND: [
      {
        OR: [
          { status: 'ACTIVE' },
          { status: 'SCHEDULED', publishAt: { not: null } },
        ],
      },
      { OR: [{ markets: { isEmpty: true } }, { markets: { has: market } }] },
      { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      { OR: [{ unpublishAt: null }, { unpublishAt: { gt: now } }] },
    ],
  };
}
const publicSelect = {
  id: true,
  name: true,
  slug: true,
  summary: true,
  description: true,
  ageGuidance: true,
  ageMin: true,
  ageMax: true,
  scenes: true,
  skills: true,
  tags: true,
  gallery: true,
  seo: true,
  specifications: true,
  playGuide: true,
  productFaq: true,
  relatedSlugs: true,
  associations: true,
  resources: true,
  createdAt: true,
  category: { select: { slug: true, name: true } },
  variants: {
    where: { status: true },
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      sku: true,
      name: true,
      attrs: true,
      msrpCents: true,
      salePriceCents: true,
      marketPrices: true,
      weightGrams: true,
      availabilityPolicy: true,
      backorderLimit: true,
      leadTimeDays: true,
      stock: {
        select: { available: true, syncError: true, lowThreshold: true },
      },
      marketInventory: {
        select: {
          market: true,
          available: true,
          syncError: true,
          lowThreshold: true,
        },
      },
    },
  },
} as const;
type PublicRow = Prisma.ProductGetPayload<{ select: typeof publicSelect }>;
export interface ProductCardDto {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  categorySlug?: string;
  priceCents: number | null;
  priceSource: string | null;
  coverImage?: unknown;
  currency: string;
  retailEnabled: boolean;
  ageMin: number | null;
  ageMax: number | null;
  tags: string[];
  availability?: string;
  purchasable: boolean;
  locale: string;
  publishedLanguages: string[];
}
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}
  private publishedLanguages(row: PublicRow) {
    return publishedProductLanguages(row);
  }
  private localized(row: PublicRow, locale = 'en'): PublicRow {
    const raw = row.specifications as Prisma.JsonObject;
    const { translations, reviews: _reviews, ...specifications } = raw ?? {};
    const base = { ...row, specifications };
    if (locale === 'en' || !this.publishedLanguages(row).includes(locale))
      return base;
    const t = (translations as Record<string, Record<string, unknown>>)[locale];
    const translatedSpecs = t.specifications as
      Record<string, { label: string; value: Prisma.JsonValue }> | undefined;
    return {
      ...base,
      name: String(t.name),
      seo: productSeoForLanguage(row, locale) as Prisma.JsonObject,
      summary: String(t.summary),
      description: t.description ? String(t.description) : null,
      ageGuidance: t.ageGuidance ? String(t.ageGuidance) : null,
      playGuide: t.playGuide ? String(t.playGuide) : null,
      specifications: translatedSpecs
        ? Object.fromEntries(
            Object.entries(specifications)
              .filter(([, value]) =>
                ['string', 'number', 'boolean'].includes(typeof value),
              )
              .map(([key]) => [
                translatedSpecs[key].label,
                translatedSpecs[key].value,
              ]),
          )
        : specifications,
      productFaq: Array.isArray(t.productFaq)
        ? (t.productFaq as Prisma.JsonArray)
        : row.productFaq,
    };
  }
  private async market(code = 'US') {
    const market = await this.prisma.retailMarket.findUnique({
      where: { code },
    });
    if (market) return market;
    if (code === 'US') return DEFAULT_MARKET;
    throw new BizException(ERROR_CODES.NOT_FOUND, 'market not configured', 404);
  }
  private price(
    v: PublicRow['variants'][number],
    market: Awaited<ReturnType<CatalogService['market']>>,
  ) {
    if (!market.retailEnabled) return null;
    const p = (
      v.marketPrices as Record<
        string,
        {
          msrpCents?: number;
          salePriceCents?: number;
          currency?: string;
          startsAt?: string;
          endsAt?: string;
        }
      >
    )[market.code];
    if (
      (market.currency !== 'USD' && p?.currency !== market.currency) ||
      (p?.currency && p.currency !== market.currency)
    )
      return null;
    const now = new Date();
    if (
      p &&
      ((p.startsAt && new Date(p.startsAt) > now) ||
        (p.endsAt && new Date(p.endsAt) <= now))
    )
      return null;
    return resolveRetailPrice(p ?? v);
  }
  private card(
    row: PublicRow,
    market: Awaited<ReturnType<CatalogService['market']>>,
    locale = 'en',
    enabledLanguages = ['en', 'zh'],
  ): ProductCardDto {
    const publishedLanguages = this.publishedLanguages(row).filter((lang) =>
      enabledLanguages.includes(lang),
    );
    const resolvedLocale = publishedLanguages.includes(locale) ? locale : 'en';
    row = this.localized(row, resolvedLocale);
    const states = row.variants.map((v) => inventoryAvailability(v, market));
    const prices = row.variants
      .flatMap((v) => {
        const p = this.price(v, market);
        return p ? [p] : [];
      })
      .sort((a, b) => a.priceCents - b.priceCents);
    return {
      id: row.id,
      locale: resolvedLocale,
      publishedLanguages,
      slug: row.slug,
      name: row.name,
      summary: row.summary ?? undefined,
      categorySlug: row.category?.slug,
      priceCents: prices[0]?.priceCents ?? null,
      priceSource: prices[0]?.source ?? null,
      coverImage: galleryFor(row.gallery, resolvedLocale, market.code)[0],
      currency: market.currency,
      retailEnabled: market.retailEnabled,
      ageMin: row.ageMin,
      ageMax: row.ageMax,
      tags: row.tags,
      purchasable: states.some((s) => s.purchasable),
      availability:
        market.inventoryDisplay === 'HIDDEN'
          ? undefined
          : (states.find((s) => s.availability === 'IN_STOCK')?.availability ??
            states.find((s) => s.purchasable)?.availability ??
            states.find((s) => s.availability === 'CHECK_AVAILABILITY')
              ?.availability ??
            'OUT_OF_STOCK'),
    };
  }
  async list(query: CatalogQueryDto) {
    const market = await this.market(query.market);
    const localePolicy = await readLocalePolicy(this.prisma),
      locale = localePolicy.languages.includes(query.locale ?? 'en')
        ? (query.locale ?? 'en')
        : 'en';
    query.sort ??= market.defaultSort;
    if (query.categorySlug) {
      const category = await this.prisma.productCategory.findUnique({
        where: { slug: query.categorySlug },
      });
      if (category) {
        const checks: [string, unknown][] = [
          ['age', query.age],
          ['scene', query.scene],
          ['skill', query.skill],
          ['price', query.minPrice],
          ['price', query.maxPrice],
          ['stock', query.stock === 'in' ? true : undefined],
        ];
        const disabled = checks.find(
          ([key, value]) =>
            value !== undefined && !category.filterableFields.includes(key),
        );
        if (disabled)
          throw new BizException(
            ERROR_CODES.VALIDATION,
            `filter ${disabled[0]} is disabled for this category`,
            422,
          );
      }
    }
    const where: Prisma.ProductWhereInput = {
      ...publicProductWhere(market.code),
      ...(query.ids ? { id: { in: [...new Set(query.ids.split(','))] } } : {}),
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { summary: { contains: query.search, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    sku: { contains: query.search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.scene ? { scenes: { has: query.scene } } : {}),
      ...(query.skill ? { skills: { has: query.skill } } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.age !== undefined
        ? { ageMin: { lte: query.age }, ageMax: { gte: query.age } }
        : {}),
      ...(query.stock === 'in'
        ? {
            variants: {
              some: {
                status: true,
                stock: { available: { gt: 0 }, syncError: null },
              },
            },
          }
        : {}),
    };
    if (localePolicy.fallback === 'HIDE' && locale !== 'en')
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          specifications: {
            path: ['translations', locale, 'status'],
            equals: 'PUBLISHED',
          },
        },
      ];
    const rows = await this.prisma.product.findMany({
      where,
      select: publicSelect,
      orderBy: query.sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' },
    });
    let cards = rows
      .filter(
        (r) =>
          localePolicy.fallback !== 'HIDE' ||
          locale === 'en' ||
          this.publishedLanguages(r).includes(locale),
      )
      .filter(
        (r) =>
          query.stock !== 'in' ||
          r.variants.some((v) => {
            const s = inventoryAvailability(v, market);
            return s.available > 0 && s.purchasable;
          }),
      )
      .map((r) => this.card(r, market, locale, localePolicy.languages))
      .filter(
        (c) =>
          (query.minPrice === undefined ||
            (c.priceCents !== null && c.priceCents >= query.minPrice)) &&
          (query.maxPrice === undefined ||
            (c.priceCents !== null && c.priceCents <= query.maxPrice)),
      );
    if (query.sort === 'price-asc')
      cards.sort(
        (a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity),
      );
    if (query.sort === 'price-desc')
      cards.sort((a, b) => (b.priceCents ?? -1) - (a.priceCents ?? -1));
    if (query.sort === 'featured')
      cards.sort(
        (a, b) =>
          Number(b.tags.includes('Featured')) -
          Number(a.tags.includes('Featured')),
      );
    return {
      ...toPaged(
        cards.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
        cards.length,
        query,
      ),
      sort: query.sort,
    };
  }
  async findBySlug(slug: string, marketCode = 'US', locale = 'en') {
    const market = await this.market(marketCode);
    const localePolicy = await readLocalePolicy(this.prisma);
    if (!localePolicy.languages.includes(locale)) locale = 'en';
    const row = await this.prisma.product.findFirst({
      where: { slug, ...publicProductWhere(market.code) },
      select: publicSelect,
    });
    if (!row)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'product not found', 404);
    const publishedLanguages = this.publishedLanguages(row).filter((lang) =>
      localePolicy.languages.includes(lang),
    );
    if (
      locale !== 'en' &&
      !publishedLanguages.includes(locale) &&
      localePolicy.fallback === 'HIDE'
    )
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'product translation is not published',
        404,
      );
    const resolvedLocale = publishedLanguages.includes(locale) ? locale : 'en';
    const associations = (
      Array.isArray(row.associations) ? row.associations : []
    ).filter(
      (a) =>
        a &&
        typeof a === 'object' &&
        !Array.isArray(a) &&
        typeof a.slug === 'string' &&
        ['RELATED', 'ACCESSORY', 'REPLACEMENT'].includes(String(a.type)),
    ) as Array<{ type: string; slug: string }>;
    const relatedSlugs = [
      ...new Set([
        ...row.relatedSlugs,
        ...associations.filter((a) => a.type === 'RELATED').map((a) => a.slug),
      ]),
    ];
    const [related, associated] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          ...publicProductWhere(market.code),
          slug: { not: slug },
          ...(relatedSlugs.length
            ? { slug: { in: relatedSlugs } }
            : row.category
              ? { category: { slug: row.category.slug } }
              : {}),
        },
        select: publicSelect,
        take: 4,
      }),
      this.prisma.product.findMany({
        where: {
          ...publicProductWhere(market.code),
          slug: {
            in: associations
              .filter((a) => a.type !== 'RELATED' && a.slug !== slug)
              .map((a) => a.slug),
          },
        },
        select: publicSelect,
      }),
    ]);
    const relatedCards = (rows: typeof associated) =>
      rows
        .filter(
          (r) =>
            localePolicy.fallback !== 'HIDE' ||
            locale === 'en' ||
            this.publishedLanguages(r).includes(locale),
        )
        .map((r) =>
          this.card(r, market, resolvedLocale, localePolicy.languages),
        );
    const {
      variants,
      createdAt: _,
      ...product
    } = this.localized(row, resolvedLocale);
    const resources = Array.isArray(product.resources)
      ? product.resources.filter(
          (r) =>
            r &&
            typeof r === 'object' &&
            !Array.isArray(r) &&
            (!('visibility' in r) || r.visibility === 'PUBLIC'),
        )
      : [];
    return {
      ...product,
      associations: undefined,
      relatedSlugs: undefined,
      rating: publishedRating(row.specifications),
      gallery: galleryFor(product.gallery, resolvedLocale, market.code),
      locale: resolvedLocale,
      publishedLanguages,
      indexableLanguages: indexableProductLanguages(row).filter((language) =>
        localePolicy.languages.includes(language),
      ),
      resources,
      currency: market.currency,
      market: market.code,
      retailEnabled: market.retailEnabled,
      relatedProducts: related
        .filter(
          (r) =>
            localePolicy.fallback !== 'HIDE' ||
            locale === 'en' ||
            this.publishedLanguages(r).includes(locale),
        )
        .map((r) =>
          this.card(r, market, resolvedLocale, localePolicy.languages),
        ),
      accessories: relatedCards(
        associated.filter((p) =>
          associations.some((a) => a.type === 'ACCESSORY' && a.slug === p.slug),
        ),
      ),
      replacements: relatedCards(
        associated.filter((p) =>
          associations.some(
            (a) => a.type === 'REPLACEMENT' && a.slug === p.slug,
          ),
        ),
      ),
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        attrs:
          v.attrs && typeof v.attrs === 'object' && !Array.isArray(v.attrs)
            ? {
                ...v.attrs,
                ...('gallery' in v.attrs
                  ? {
                      gallery: galleryFor(
                        v.attrs.gallery,
                        resolvedLocale,
                        market.code,
                      ),
                    }
                  : {}),
              }
            : v.attrs,
        weightGrams: v.weightGrams,
        price: this.price(v, market),
        ...(() => {
          const {
            available: _,
            capacity: __,
            backorderLimit: ___,
            ...visible
          } = inventoryAvailability(v, market);
          return visible;
        })(),
      })),
    };
  }
  async categories(market = 'US') {
    const cats = await this.prisma.productCategory.findMany({
      where: { active: true },
      select: {
        code: true,
        slug: true,
        name: true,
        description: true,
        coverImage: true,
        seo: true,
        parentId: true,
        id: true,
        filterableFields: true,
        _count: { select: { products: { where: publicProductWhere(market) } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return cats.map((c) => ({
      code: c.code,
      slug: c.slug,
      name: c.name,
      description: c.description,
      coverImage: c.coverImage,
      seo: c.seo,
      parentId: c.parentId,
      id: c.id,
      productCount: c._count.products,
      filterableFields: c.filterableFields,
    }));
  }
}

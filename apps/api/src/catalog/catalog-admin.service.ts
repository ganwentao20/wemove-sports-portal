import { ratingSettings } from './rating-policy.js';
import type { ProductRatingDto } from './dto/product-rating.dto.js';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { toPaged } from '../common/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PRODUCT_LOCALE_PATTERN,
  publishedProductLanguages,
} from './product-locales.js';
import type {
  AdminProductQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
  ProductMerchandisingDto,
  CatalogImportDto,
} from './dto/catalog-admin.dto.js';

@Injectable()
export class CatalogAdminService {
  private validateSeo(value: unknown) {
    if (value === undefined) return;
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'SEO settings must be an object',
        422,
      );
    const seo = value as Record<string, unknown>;
    for (const key of [
      'title',
      'description',
      'ogTitle',
      'ogDescription',
      'ogImage',
      'canonical',
      'robots',
    ])
      if (
        seo[key] !== undefined &&
        (typeof seo[key] !== 'string' ||
          String(seo[key]).length >
            (['ogImage', 'canonical'].includes(key) ? 2048 : 500))
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          `Invalid SEO ${key}`,
          422,
        );
    for (const key of ['canonical', 'ogImage'])
      if (seo[key] && !/^(https:\/\/|\/(?!\/))[^\s\\]+$/.test(String(seo[key])))
        throw new BizException(
          ERROR_CODES.VALIDATION,
          `${key} must be a local path or HTTPS URL`,
          422,
        );
    if (seo.noindex !== undefined && typeof seo.noindex !== 'boolean')
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'SEO noindex must be a boolean',
        422,
      );
  }
  private validateGallery(value: unknown) {
    if (value === undefined) return;
    if (!Array.isArray(value) || value.length > 50)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'Gallery must contain at most 50 media entries',
        422,
      );
    for (const entry of value) {
      const row = entry as Record<string, unknown>;
      if (
        !row ||
        typeof row.url !== 'string' ||
        !/^(https?:\/\/|\/(?!\/))/.test(row.url) ||
        typeof row.alt !== 'string' ||
        row.alt.length > 400 ||
        (row.locale && !PRODUCT_LOCALE_PATTERN.test(String(row.locale))) ||
        (row.market && !/^[A-Z]{2}$/.test(String(row.market))) ||
        (row.type && !['image', 'video'].includes(String(row.type)))
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'Gallery entries require a valid URL, alt text, image/video type, supported language and optional two-letter market',
          422,
        );
    }
  }
  private validateTranslation(row: {
    specifications: unknown;
    description?: string | null;
    ageGuidance?: string | null;
    playGuide?: string | null;
    productFaq?: unknown;
  }) {
    const translations = (row.specifications as Record<string, unknown>)
      ?.translations as Record<string, Record<string, unknown>> | undefined;
    const published = publishedProductLanguages(row);
    for (const [locale, translation] of Object.entries(translations ?? {})) {
      this.validateSeo(translation?.seo);
      if (
        translation?.status !== undefined &&
        !['NOT_STARTED', 'IN_PROGRESS', 'READY', 'PUBLISHED', 'DRAFT'].includes(
          String(translation.status),
        )
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'Invalid product translation status',
          422,
        );
      if (!PRODUCT_LOCALE_PATTERN.test(locale) || locale === 'en')
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'Translation language must use a supported language code; edit English in the source fields',
          422,
        );
      if (translation?.status === 'PUBLISHED' && !published.includes(locale))
        throw new BizException(
          ERROR_CODES.VALIDATION,
          `Published ${locale} translation must include name, summary and every populated description, age guidance, play guide, specification and FAQ field`,
          422,
        );
      if (
        translation?.status === 'READY' &&
        !publishedProductLanguages({
          ...row,
          specifications: {
            ...(row.specifications as Record<string, unknown>),
            translations: { [locale]: { ...translation, status: 'PUBLISHED' } },
          },
        }).includes(locale)
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          `Complete the ${locale} translation before marking it ready`,
          422,
        );
    }
  }
  private validateAvailability(row: {
    availabilityPolicy?: string;
    backorderLimit?: number;
    leadTimeDays?: number | null;
  }) {
    if (
      row.availabilityPolicy &&
      row.availabilityPolicy !== 'IN_STOCK_ONLY' &&
      (!(row.backorderLimit ?? 0) || !row.leadTimeDays)
    )
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'Preorders and backorders require a positive quantity limit and estimated dispatch days',
        422,
      );
  }
  private async ensureBarcode(barcode: string | undefined, id?: string) {
    if (!barcode?.trim()) return;
    const duplicate = await this.prisma.productVariant.findFirst({
      where: { barcode: barcode.trim(), ...(id ? { id: { not: id } } : {}) },
    });
    if (duplicate)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        `barcode already belongs to SKU ${duplicate.sku}`,
        409,
      );
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listProducts(query: AdminProductQueryDto) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                slug: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                variants: {
                  some: {
                    sku: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: {
            select: { id: true, code: true, name: true, slug: true },
          },
          variants: {
            include: { stock: true, marketInventory: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return toPaged(items, total, query);
  }

  categories() {
    return this.prisma.productCategory.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreateCategoryDto, actor: JwtPayload) {
    this.categoryMetadata(dto);
    await this.ensureCategoryUnique(dto.code, dto.slug);
    if (dto.parentId) await this.ensureCategory(dto.parentId);
    const category = await this.prisma.productCategory.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        slug: dto.slug.trim().toLowerCase(),
        name: dto.name.trim(),
        parentId: dto.parentId ?? null,
        active: dto.active,
        sortOrder: dto.sortOrder,
        ...this.categoryMetadata(dto),
      },
    });
    this.auditChange(
      actor,
      'catalog.category.create',
      'productCategory',
      category.id,
      undefined,
      category,
    );
    return category;
  }

  private categoryMetadata(dto: CreateCategoryDto) {
    this.validateSeo(dto.seo ?? undefined);
    if (dto.coverImage) {
      const cover = dto.coverImage;
      if (
        typeof cover.url !== 'string' ||
        !/^(https:\/\/|\/(?!\/))[^\s\\]+$/.test(cover.url) ||
        typeof cover.alt !== 'string' ||
        cover.alt.length > 400
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'Category cover requires a local/HTTPS URL and alt text',
          422,
        );
    }
    return {
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
      ...(dto.coverImage !== undefined
        ? {
            coverImage:
              (dto.coverImage as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          }
        : {}),
      ...(dto.seo !== undefined
        ? { seo: (dto.seo as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };
  }
  async updateCategory(id: string, dto: CreateCategoryDto, actor: JwtPayload) {
    const before = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!before)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
    await this.ensureCategoryUnique(dto.code, dto.slug, id);
    const seen = new Set([id]);
    let parentId = dto.parentId;
    while (parentId) {
      if (seen.has(parentId))
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'Category hierarchy cannot contain a cycle',
          422,
        );
      seen.add(parentId);
      const parent = await this.prisma.productCategory.findUnique({
        where: { id: parentId },
        select: { parentId: true },
      });
      if (!parent)
        throw new BizException(
          ERROR_CODES.NOT_FOUND,
          'Parent category not found',
          404,
        );
      parentId = parent.parentId;
    }
    const category = await this.prisma.productCategory.update({
      where: { id },
      data: {
        code: dto.code.toUpperCase(),
        slug: dto.slug.toLowerCase(),
        name: dto.name.trim(),
        parentId: dto.parentId === undefined ? before.parentId : dto.parentId,
        active: dto.active,
        sortOrder: dto.sortOrder,
        ...this.categoryMetadata(dto),
      },
    });
    this.auditChange(
      actor,
      'catalog.category.update',
      'productCategory',
      id,
      before,
      category,
    );
    return category;
  }

  async createProduct(dto: CreateProductDto, actor: JwtPayload) {
    this.validateSeo(dto.seo);
    this.validateGallery(dto.gallery);
    this.validateTranslation({
      ...dto,
      specifications: dto.specifications ?? {},
    });
    if (dto.status === 'SCHEDULED' && !dto.publishAt)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'scheduled products require a publish time',
        422,
      );
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);
    await this.validateTemplate(
      dto.categoryId,
      dto.specifications ?? {},
      dto.status,
    );
    await this.ensureProductSlug(dto.slug);
    const product = await this.prisma.product.create({
      data: {
        ...this.merchandising(dto),
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
        summary: dto.summary?.trim() || null,
        description: dto.description?.trim() || null,
        ageGuidance: dto.ageGuidance?.trim() || null,
        resources: (dto.resources ?? []) as Prisma.InputJsonValue,
        categoryId: dto.categoryId ?? null,
        status: dto.status,
      },
    });
    this.auditChange(
      actor,
      'catalog.product.create',
      'product',
      product.id,
      undefined,
      product,
    );
    return product;
  }

  async updateRating(id: string, dto: ProductRatingDto, actor: JwtPayload) {
    const reviews = ratingSettings(dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${id} FOR UPDATE`;
      const before = await tx.product.findUnique({ where: { id } });
      if (!before)
        throw new BizException(ERROR_CODES.NOT_FOUND, 'product not found', 404);
      const specifications = (
        before.specifications &&
        typeof before.specifications === 'object' &&
        !Array.isArray(before.specifications)
          ? before.specifications
          : {}
      ) as Prisma.InputJsonObject;
      await tx.product.update({
        where: { id },
        data: { specifications: { ...specifications, reviews } },
      });
      await tx.auditLog.create({
        data: {
          actorKind: 'STAFF',
          actorStaffId: actor.sub,
          action: 'catalog.product.reviews',
          entityType: 'product',
          entityId: id,
          before: specifications.reviews ?? Prisma.DbNull,
          after: reviews,
        },
      });
      return reviews;
    });
  }
  async updateProduct(id: string, dto: UpdateProductDto, actor: JwtPayload) {
    this.validateSeo(dto.seo);
    this.validateGallery(dto.gallery);
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'product not found', 404);
    const effective = {
      ...before,
      ...Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined),
      ),
    };
    this.validateTranslation(effective);
    if ((dto.status ?? before.status) === 'SCHEDULED' && !effective.publishAt)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'scheduled products require a publish time',
        422,
      );
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);
    await this.validateTemplate(
      dto.categoryId ?? before.categoryId,
      dto.specifications ?? before.specifications,
      dto.status ?? before.status,
    );
    if (dto.slug && dto.slug.toLowerCase() !== before.slug)
      await this.ensureProductSlug(dto.slug);
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...this.merchandising(dto),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.slug !== undefined
          ? { slug: dto.slug.trim().toLowerCase() }
          : {}),
        ...(dto.summary !== undefined
          ? { summary: dto.summary.trim() || null }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.ageGuidance !== undefined
          ? { ageGuidance: dto.ageGuidance.trim() || null }
          : {}),
        ...(dto.resources !== undefined
          ? { resources: dto.resources as Prisma.InputJsonValue }
          : {}),
        ...(dto.categoryId !== undefined
          ? { categoryId: dto.categoryId || null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    this.auditChange(
      actor,
      'catalog.product.update',
      'product',
      id,
      before,
      product,
    );
    if (
      (dto.slug && dto.slug !== before.slug) ||
      (dto.status === 'ARCHIVED' && dto.archiveRedirect)
    ) {
      const targetUrl =
        dto.status === 'ARCHIVED'
          ? dto.archiveRedirect!
          : `/products/${product.slug}`;
      await this.prisma.redirectRule.upsert({
        where: { sourcePath: `/products/${before.slug}` },
        create: {
          sourcePath: `/products/${before.slug}`,
          targetUrl,
          statusCode: 301,
        },
        update: { targetUrl, statusCode: 301, active: true },
      });
    }
    return product;
  }

  async createVariant(
    productId: string,
    dto: CreateVariantDto,
    actor: JwtPayload,
  ) {
    await this.ensureProduct(productId);
    this.validateGallery(dto.attrs?.gallery);
    this.validateAvailability(dto);
    this.validateMarketPrices(dto.marketPrices);
    await this.ensureBarcode(dto.barcode);
    await this.ensureSku(dto.sku);
    const variant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          productId,
          barcode: dto.barcode?.trim() || null,
          availabilityPolicy: dto.availabilityPolicy,
          backorderLimit: dto.backorderLimit,
          leadTimeDays: dto.leadTimeDays,
          marketPrices: (dto.marketPrices ?? {}) as Prisma.InputJsonValue,
          sku: dto.sku.trim().toUpperCase(),
          name: dto.name?.trim() || null,
          attrs: (dto.attrs ?? {}) as Prisma.InputJsonValue,
          msrpCents: dto.msrpCents ?? null,
          salePriceCents: dto.salePriceCents ?? null,
          b2bDefaultPriceCents: dto.b2bDefaultPriceCents ?? null,
          weightGrams: dto.weightGrams ?? null,
          status: dto.status,
          sortOrder: dto.sortOrder,
        },
      });
      await tx.stock.create({
        data: { variantId: created.id, available: dto.available },
      });
      return tx.productVariant.findUniqueOrThrow({
        where: { id: created.id },
        include: { stock: true, marketInventory: true },
      });
    });
    this.auditChange(
      actor,
      'catalog.variant.create',
      'productVariant',
      variant.id,
      undefined,
      variant,
    );
    return variant;
  }

  async updateVariant(id: string, dto: UpdateVariantDto, actor: JwtPayload) {
    this.validateGallery(dto.attrs?.gallery);
    this.validateMarketPrices(dto.marketPrices);
    await this.ensureBarcode(dto.barcode, id);
    if (dto.syncError && dto.available !== undefined)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'failed synchronization must preserve the last known stock count',
        422,
      );
    const before = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { stock: true, marketInventory: true },
    });
    if (!before)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'variant not found', 404);
    this.validateAvailability({
      ...before,
      ...Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined),
      ),
    });
    if (dto.sku && dto.sku.toUpperCase() !== before.sku)
      await this.ensureSku(dto.sku);
    const variant = await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id },
        data: {
          ...(dto.barcode !== undefined
            ? { barcode: dto.barcode.trim() || null }
            : {}),
          availabilityPolicy: dto.availabilityPolicy,
          backorderLimit: dto.backorderLimit,
          leadTimeDays: dto.leadTimeDays,
          ...(dto.marketPrices !== undefined
            ? { marketPrices: dto.marketPrices as Prisma.InputJsonValue }
            : {}),
          ...(dto.sku !== undefined
            ? { sku: dto.sku.trim().toUpperCase() }
            : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
          ...(dto.attrs !== undefined
            ? { attrs: dto.attrs as Prisma.InputJsonValue }
            : {}),
          ...(dto.msrpCents !== undefined ? { msrpCents: dto.msrpCents } : {}),
          ...(dto.salePriceCents !== undefined
            ? { salePriceCents: dto.salePriceCents }
            : {}),
          ...(dto.b2bDefaultPriceCents !== undefined
            ? { b2bDefaultPriceCents: dto.b2bDefaultPriceCents }
            : {}),
          ...(dto.weightGrams !== undefined
            ? { weightGrams: dto.weightGrams }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
      if (
        dto.available !== undefined ||
        dto.lowThreshold !== undefined ||
        dto.inventorySource !== undefined ||
        dto.syncError !== undefined
      ) {
        await tx.stock.upsert({
          where: { variantId: id },
          create: {
            variantId: id,
            available: dto.available ?? 0,
            lowThreshold: dto.lowThreshold,
            source: dto.inventorySource ?? 'MANUAL',
            syncError: dto.syncError || null,
            sourceUpdatedAt: dto.available !== undefined ? new Date() : null,
          },
          update: {
            available: dto.available,
            lowThreshold: dto.lowThreshold,
            ...(dto.inventorySource ? { source: dto.inventorySource } : {}),
            ...(dto.syncError !== undefined
              ? { syncError: dto.syncError || null }
              : dto.available !== undefined
                ? { syncError: null }
                : {}),
            ...(dto.available !== undefined
              ? { sourceUpdatedAt: new Date() }
              : {}),
          },
        });
      }
      if (
        dto.msrpCents !== undefined ||
        dto.salePriceCents !== undefined ||
        dto.marketPrices !== undefined
      )
        await tx.retailPriceHistory.create({
          data: {
            variantId: id,
            actorId: actor.sub,
            before: {
              msrpCents: before.msrpCents,
              salePriceCents: before.salePriceCents,
              marketPrices: before.marketPrices,
            },
            after: dto as unknown as Prisma.InputJsonValue,
          },
        });
      return tx.productVariant.findUniqueOrThrow({
        where: { id },
        include: { stock: true, marketInventory: true },
      });
    });
    this.auditChange(
      actor,
      'catalog.variant.update',
      'productVariant',
      id,
      before,
      variant,
    );
    return variant;
  }

  private merchandising(dto: ProductMerchandisingDto) {
    if (dto.specifications && Object.hasOwn(dto.specifications, 'reviews'))
      ratingSettings(dto.specifications.reviews);
    if (
      dto.ageMin !== undefined &&
      dto.ageMax !== undefined &&
      dto.ageMin > dto.ageMax
    )
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'minimum age exceeds maximum age',
        422,
      );
    if (dto.publishAt && dto.unpublishAt && dto.publishAt >= dto.unpublishAt)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'unpublish must follow publish',
        422,
      );
    const { publishAt, unpublishAt, ...rest } = dto;
    const fields = [
      'ageMin',
      'ageMax',
      'scenes',
      'skills',
      'tags',
      'markets',
      'specifications',
      'seo',
      'playGuide',
      'productFaq',
      'gallery',
      'relatedSlugs',
      'associations',
      'archiveRedirect',
    ];
    return {
      ...Object.fromEntries(
        Object.entries(rest).filter(
          ([key, value]) => fields.includes(key) && value !== undefined,
        ),
      ),
      ...(publishAt !== undefined
        ? { publishAt: publishAt ? new Date(publishAt) : null }
        : {}),
      ...(unpublishAt !== undefined
        ? { unpublishAt: unpublishAt ? new Date(unpublishAt) : null }
        : {}),
    } as Partial<
      Pick<
        Prisma.ProductUncheckedCreateInput,
        | 'ageMin'
        | 'ageMax'
        | 'scenes'
        | 'skills'
        | 'tags'
        | 'markets'
        | 'specifications'
        | 'seo'
        | 'playGuide'
        | 'productFaq'
        | 'gallery'
        | 'relatedSlugs'
        | 'archiveRedirect'
        | 'publishAt'
        | 'unpublishAt'
      >
    >;
  }
  private async validateTemplate(
    categoryId: string | null | undefined,
    specifications: unknown,
    status: string,
  ) {
    if (!categoryId) return;
    const category = await this.prisma.productCategory.findUnique({
      where: { id: categoryId },
    });
    const fields = category?.attributeTemplate as
      | Array<{ key: string; label: string; type: string; required?: boolean }>
      | undefined;
    if (!Array.isArray(fields)) return;
    const specs = specifications as Record<string, unknown>;
    for (const field of fields) {
      if (['reviews', 'translations'].includes(field.key)) continue;
      const value = specs?.[field.key];
      if (value === undefined || value === '') {
        if (field.required && ['ACTIVE', 'SCHEDULED'].includes(status))
          throw new BizException(
            ERROR_CODES.VALIDATION,
            `required specification missing: ${field.label}`,
            422,
          );
        continue;
      }
      if (
        (field.type === 'number' && typeof value !== 'number') ||
        (field.type === 'boolean' && typeof value !== 'boolean') ||
        (field.type === 'text' && typeof value !== 'string')
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          `specification ${field.label} must be ${field.type}`,
          422,
        );
    }
  }
  private validateMarketPrices(prices: Record<string, unknown> | undefined) {
    if (prices === undefined) return;
    for (const [market, value] of Object.entries(prices)) {
      if (
        !/^[A-Z]{2}$/.test(market) ||
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'invalid market price entry',
          422,
        );
      const p = value as Record<string, unknown>;
      if (typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency))
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'market price currency required',
          422,
        );
      for (const key of ['msrpCents', 'salePriceCents'])
        if (
          p[key] !== undefined &&
          (!Number.isSafeInteger(p[key]) ||
            Number(p[key]) < 0 ||
            Number(p[key]) > 2147483647)
        )
          throw new BizException(
            ERROR_CODES.VALIDATION,
            'market prices must be nonnegative integer minor units',
            422,
          );
      if (
        (p.startsAt && Number.isNaN(Date.parse(String(p.startsAt)))) ||
        (p.endsAt && Number.isNaN(Date.parse(String(p.endsAt)))) ||
        (p.startsAt && p.endsAt && String(p.startsAt) >= String(p.endsAt))
      )
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'invalid market price validity window',
          422,
        );
    }
  }

  async exportProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        variants: { include: { stock: true, marketInventory: true } },
      },
      orderBy: { slug: 'asc' },
    });
    const escape = (v: unknown) => {
      const text = String(v ?? '');
      return `"${(/^[\t\r\n]|^\s*[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
    };
    const lines = [
      [
        'slug',
        'name',
        'sku',
        'msrpCents',
        'available',
        'status',
        'categorySlug',
        'tags',
      ].join(','),
    ];
    for (const p of products)
      for (const v of p.variants)
        lines.push(
          [
            p.slug,
            p.name,
            v.sku,
            v.msrpCents,
            v.stock?.available ?? 0,
            p.status,
            p.category?.slug ?? '',
            p.tags.join('|'),
          ]
            .map(escape)
            .join(','),
        );
    return {
      fileName: 'catalog.csv',
      csv: '\uFEFF' + lines.join('\r\n'),
      count: lines.length - 1,
    };
  }
  async importProducts(dto: CatalogImportDto, actor: JwtPayload) {
    const rows = dto.rows.map((row) => ({
      ...row,
      sku: row.sku.trim().toUpperCase(),
    }));
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (!row.sku) errors.push(`Row ${index + 1}: SKU is required`);
      if (row.tags !== undefined && !Array.isArray(row.tags))
        errors.push(
          `Row ${index + 1}: tags must be an array; use [] to clear them`,
        );
      if (seen.has(row.sku)) errors.push(`Row ${index + 1}: duplicate SKU`);
      seen.add(row.sku);
    }
    const existingIds = rows.length
      ? await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id FROM "ProductVariant"
          WHERE UPPER(BTRIM(sku)) IN (${Prisma.join([...seen])})
        `)
      : [];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: existingIds.map((variant) => variant.id) } },
      include: { product: true },
    });
    const bySku = new Map<string, (typeof variants)[number]>();
    for (const variant of variants) {
      const sku = variant.sku.trim().toUpperCase();
      if (bySku.has(sku))
        errors.push(
          `SKU ${sku} has multiple existing case variants; reconcile them before import`,
        );
      else bySku.set(sku, variant);
    }
    for (const row of rows) {
      const variant = bySku.get(row.sku);
      if (variant && variant.product.slug !== row.slug)
        errors.push(
          `SKU ${row.sku} already belongs to ${variant.product.slug}`,
        );
    }
    const existingProducts = await this.prisma.product.findMany({
      where: { slug: { in: rows.map((row) => row.slug) } },
    });
    const categories = await this.prisma.productCategory.findMany({
      where: {
        slug: {
          in: rows.flatMap((row) =>
            row.categorySlug ? [row.categorySlug] : [],
          ),
        },
      },
      select: { id: true, slug: true },
    });
    const metadataBySlug = new Map<string, string>();
    for (const row of rows) {
      const existing = existingProducts.find((p) => p.slug === row.slug),
        status = row.status ?? existing?.status ?? 'DRAFT';
      const categoryId =
        row.categorySlug === undefined
          ? existing?.categoryId
          : row.categorySlug
            ? categories.find((c) => c.slug === row.categorySlug)?.id
            : null;
      if (row.categorySlug && !categoryId)
        errors.push(
          `SKU ${row.sku}: category ${row.categorySlug} was not found`,
        );
      const metadata = JSON.stringify([row.categorySlug, row.tags]);
      if (
        metadataBySlug.has(row.slug) &&
        metadataBySlug.get(row.slug) !== metadata
      )
        errors.push(
          `Product ${row.slug}: all SKU rows must use the same category and tags`,
        );
      metadataBySlug.set(row.slug, metadata);
      if (status === 'SCHEDULED' && !existing?.publishAt)
        errors.push(
          `SKU ${row.sku}: scheduled products require a publication date before import`,
        );
      try {
        await this.validateTemplate(
          categoryId,
          existing?.specifications ?? {},
          status,
        );
      } catch (error) {
        errors.push(`SKU ${row.sku}: ${(error as Error).message}`);
      }
    }
    const preview = {
      rows: rows.length,
      creates: rows.filter((row) => !bySku.has(row.sku)).length,
      updates: bySku.size,
      errors,
    };
    if (!dto.apply || errors.length) return { ...preview, applied: false };
    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const p = await tx.product.upsert({
          where: { slug: row.slug },
          create: {
            slug: row.slug,
            name: row.name,
            status: row.status ?? 'DRAFT',
            ...(row.categorySlug
              ? {
                  categoryId: categories.find(
                    (c) => c.slug === row.categorySlug,
                  )!.id,
                }
              : {}),
            ...(row.tags !== undefined
              ? {
                  tags: [
                    ...new Set(row.tags.map((t) => t.trim()).filter(Boolean)),
                  ],
                }
              : {}),
          },
          update: {
            name: row.name,
            ...(row.status ? { status: row.status } : {}),
            ...(row.categorySlug !== undefined
              ? {
                  categoryId: row.categorySlug
                    ? categories.find((c) => c.slug === row.categorySlug)!.id
                    : null,
                }
              : {}),
            ...(row.tags !== undefined
              ? {
                  tags: [
                    ...new Set(row.tags.map((t) => t.trim()).filter(Boolean)),
                  ],
                }
              : {}),
          },
        });
        const before = bySku.get(row.sku);
        const v = await tx.productVariant.upsert({
          where: before ? { id: before.id } : { sku: row.sku },
          create: { productId: p.id, sku: row.sku, msrpCents: row.msrpCents },
          update: { sku: row.sku, msrpCents: row.msrpCents },
        });
        await tx.stock.upsert({
          where: { variantId: v.id },
          create: {
            variantId: v.id,
            available: row.available,
            source: 'CSV',
            sourceUpdatedAt: new Date(),
          },
          update: {
            available: row.available,
            source: 'CSV',
            sourceUpdatedAt: new Date(),
            syncError: null,
          },
        });
        await tx.retailPriceHistory.create({
          data: {
            variantId: v.id,
            actorId: actor.sub,
            before: { msrpCents: before?.msrpCents ?? null },
            after: { msrpCents: row.msrpCents },
          },
        });
      }
    });
    this.auditChange(
      actor,
      'catalog.bulk.import',
      'catalog',
      'batch',
      preview,
      { rows: rows.length },
    );
    return { ...preview, applied: true };
  }
  priceHistory(variantId: string) {
    return this.prisma.retailPriceHistory.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async categoryTemplate(
    id: string,
    dto: {
      attributeTemplate: Array<{
        key: string;
        label: string;
        type: string;
        required?: boolean;
      }>;
      filterableFields: string[];
    },
    actor: JwtPayload,
  ) {
    if (
      dto.attributeTemplate.some(
        (f) =>
          !/^[a-zA-Z][a-zA-Z0-9_ -]{0,60}$/.test(f.key) ||
          ['reviews', 'translations'].includes(f.key) ||
          typeof f.label !== 'string' ||
          !['text', 'number', 'boolean'].includes(f.type),
      ) ||
      new Set(dto.attributeTemplate.map((f) => f.key)).size !==
        dto.attributeTemplate.length
    )
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'attribute keys must be unique and cannot use reviews or translations; types must be text, number or boolean',
        422,
      );
    const result = await this.prisma.productCategory.update({
      where: { id },
      data: {
        attributeTemplate:
          dto.attributeTemplate as unknown as Prisma.InputJsonValue,
        filterableFields: dto.filterableFields,
      },
    });
    this.auditChange(
      actor,
      'catalog.category.template',
      'productCategory',
      id,
      undefined,
      dto,
    );
    return result;
  }
  async copyProduct(
    id: string,
    slug: string,
    skuPrefix: string,
    actor: JwtPayload,
  ) {
    const source = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { variants: true },
    });
    await this.ensureProductSlug(slug);
    const result = await this.prisma.$transaction(async (tx) => {
      const {
        id: _id,
        createdAt: _created,
        updatedAt: _updated,
        variants,
        ...data
      } = source;
      const product = await tx.product.create({
        data: {
          ...data,
          resources: data.resources as Prisma.InputJsonValue,
          gallery: data.gallery as Prisma.InputJsonValue,
          specifications: {
            ...(data.specifications as Prisma.InputJsonObject),
            reviews: { enabled: false, average: 0, count: 0, source: '' },
          },
          productFaq: data.productFaq as Prisma.InputJsonValue,
          seo: data.seo ?? Prisma.JsonNull,
          associations: data.associations as Prisma.InputJsonValue,
          status: 'DRAFT',
          slug,
          name: `${source.name} (copy)`,
          publishAt: null,
          unpublishAt: null,
          variants: {
            create: variants.map((v, index) => ({
              sku: `${skuPrefix}-${index + 1}`,
              name: v.name,
              attrs: v.attrs as Prisma.InputJsonValue,
              msrpCents: v.msrpCents,
              salePriceCents: v.salePriceCents,
              b2bDefaultPriceCents: v.b2bDefaultPriceCents,
              marketPrices: v.marketPrices as Prisma.InputJsonValue,
              weightGrams: v.weightGrams,
              status: v.status,
              stock: { create: { available: 0 } },
            })),
          },
        },
      });
      return product;
    });
    this.auditChange(
      actor,
      'catalog.product.copy',
      'product',
      result.id,
      { sourceId: id },
      result,
    );
    return result;
  }

  private auditChange(
    actor: JwtPayload,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action,
      entityType,
      entityId,
      before,
      after,
    });
  }

  private async ensureCategory(id: string) {
    if (
      !(await this.prisma.productCategory.findUnique({
        where: { id },
        select: { id: true },
      }))
    ) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'category not found', 404);
    }
  }

  private async ensureCategoryUnique(code: string, slug: string, id?: string) {
    const found = await this.prisma.productCategory.findFirst({
      where: {
        OR: [{ code: code.toUpperCase() }, { slug: slug.toLowerCase() }],
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
    if (found)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'category code or slug already exists',
        409,
      );
  }

  private async ensureProduct(id: string) {
    if (
      !(await this.prisma.product.findUnique({
        where: { id },
        select: { id: true },
      }))
    ) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'product not found', 404);
    }
  }

  private async ensureProductSlug(slug: string) {
    if (
      await this.prisma.product.findUnique({
        where: { slug: slug.toLowerCase() },
        select: { id: true },
      })
    ) {
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'product slug already exists',
        409,
      );
    }
  }

  private async ensureSku(sku: string) {
    if (
      await this.prisma.productVariant.findUnique({
        where: { sku: sku.toUpperCase() },
        select: { id: true },
      })
    ) {
      throw new BizException(ERROR_CODES.CONFLICT, 'SKU already exists', 409);
    }
  }
}

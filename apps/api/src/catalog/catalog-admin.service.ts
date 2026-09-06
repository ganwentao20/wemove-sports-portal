import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { toPaged } from '../common/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminProductQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/catalog-admin.dto.js';

@Injectable()
export class CatalogAdminService {
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
          variants: { include: { stock: true }, orderBy: { sortOrder: 'asc' } },
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

  async createProduct(dto: CreateProductDto, actor: JwtPayload) {
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);
    await this.ensureProductSlug(dto.slug);
    const product = await this.prisma.product.create({
      data: {
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

  async updateProduct(id: string, dto: UpdateProductDto, actor: JwtPayload) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'product not found', 404);
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);
    if (dto.slug && dto.slug.toLowerCase() !== before.slug)
      await this.ensureProductSlug(dto.slug);
    const product = await this.prisma.product.update({
      where: { id },
      data: {
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
    return product;
  }

  async createVariant(
    productId: string,
    dto: CreateVariantDto,
    actor: JwtPayload,
  ) {
    await this.ensureProduct(productId);
    await this.ensureSku(dto.sku);
    const variant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          productId,
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
        include: { stock: true },
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
    const before = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { stock: true },
    });
    if (!before)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'variant not found', 404);
    if (dto.sku && dto.sku.toUpperCase() !== before.sku)
      await this.ensureSku(dto.sku);
    const variant = await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id },
        data: {
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
      if (dto.available !== undefined) {
        await tx.stock.upsert({
          where: { variantId: id },
          create: { variantId: id, available: dto.available },
          update: { available: dto.available },
        });
      }
      return tx.productVariant.findUniqueOrThrow({
        where: { id },
        include: { stock: true },
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

  private async ensureCategoryUnique(code: string, slug: string) {
    const found = await this.prisma.productCategory.findFirst({
      where: {
        OR: [{ code: code.toUpperCase() }, { slug: slug.toLowerCase() }],
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPaged } from '../common/pagination.dto.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { resolveRetailPrice } from '../pricing/pricing-engine.js';
import type { Paged } from '../common/api-response.js';

/**
 * 商品目录（MC 演示切片，公开只读）：
 * 安全红线 —— 公开响应只允许携带零售价字段（msrp/sale 映射后的 cents），
 * b2bDefaultPriceCents / PricingRule 任何底层价格均不出现在公开映射中（防越权抓底价）。
 * 库存可用量同样对游客隐藏。
 */

// Prisma 6 的 select 形状导出（生成后类型自动严格化，这里映射层以最小白名单为准）
type ProductPublicRow = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  gallery: unknown;
  seo: unknown;
  category: { slug: string; name: string } | null;
  variants: {
    id: string;
    sku: string;
    name: string | null;
    attrs: unknown;
    msrpCents: number | null;
    salePriceCents: number | null;
  }[];
};

export interface ProductCardDto {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  categorySlug?: string;
  priceCents: number | null; // 零售展示价（sale ?? msrp）
  priceSource: 'SALE' | 'MSRP' | null;
  coverImage?: unknown;
}

function toCard(row: ProductPublicRow): ProductCardDto {
  // 变体区间“最低零售价”（sale ?? msrp）：PLP 卡片展示起点价
  let lowestCents: number | null = null;
  for (const v of row.variants) {
    const price = resolveRetailPrice({ msrpCents: v.msrpCents, salePriceCents: v.salePriceCents });
    if (price && (lowestCents === null || price.priceCents < lowestCents)) {
      lowestCents = price.priceCents;
    }
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary ?? undefined,
    categorySlug: row.category?.slug,
    priceCents: lowestCents,
    priceSource: lowestCents !== null ? 'MSRP' : null, // 起点价语义：MSRP 展示；SALE 精度在 PDP
    coverImage: Array.isArray(row.gallery) && row.gallery.length > 0 ? (row.gallery as unknown[])[0] : undefined,
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** 公开列表：关键字（名称/摘要）+ 分类 slug 过滤 + 分页 */
  async list(query: { page: number; pageSize: number; search?: string; categorySlug?: string }): Promise<Paged<ProductCardDto>> {
    const where = {
      status: 'ACTIVE' as const,
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { summary: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: this.publicSelect(),
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return toPaged(rows.map(toCard), total, query);
  }

  /** 商品详情（PDP 数据源） */
  async findBySlug(slug: string) {
    const row = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        category: { select: { slug: true, name: true } },
        variants: { where: { status: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!row) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'product not found', 404);
    }

    // 白名单出参（演示：绝不整表透出 variant，价格列只映射零售）
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      description: row.description,
      gallery: row.gallery,
      category: row.category,
      seo: row.seo,
      variants: row.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        attrs: v.attrs,
        price: resolveRetailPrice({ msrpCents: v.msrpCents, salePriceCents: v.salePriceCents }),
        // 说明：经销商价格（价格表/企业专属/等级价/B2B 默认）一律经 /dealer 专属端点 + 鉴权输出（组员 B/C）
      })),
    };
  }

  async categories() {
    const cats = await this.prisma.productCategory.findMany({
      where: { active: true },
      select: {
        code: true,
        slug: true,
        name: true,
        sortOrder: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return cats.map((c) => ({
      code: c.code,
      slug: c.slug,
      name: c.name,
      productCount: c._count.products,
    }));
  }

  private publicSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      summary: true,
      gallery: true,
      seo: true,
      category: { select: { slug: true, name: true } },
      variants: {
        where: { status: true },
        select: {
          id: true,
          sku: true,
          name: true,
          attrs: true,
          msrpCents: true,
          salePriceCents: true,
        },
      },
    } as const;
  }
}

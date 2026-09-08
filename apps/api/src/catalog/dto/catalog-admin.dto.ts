import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  IsDateString,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { PageQueryDto } from '../../common/pagination.dto.js';

const DB_INT_MAX = 2_147_483_647;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE = /^[A-Z0-9_][A-Z0-9_-]*$/;

export class AdminProductQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class CreateCategoryDto {
  @IsString()
  @Matches(CODE)
  @MaxLength(40)
  code!: string;

  @IsString()
  @Matches(SLUG)
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsObject() coverImage?: Record<string, unknown> | null;
  @IsOptional() @IsObject() seo?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  active: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  sortOrder: number = 0;
}

export class ProductAssociationDto {
  @IsIn(['RELATED', 'ACCESSORY', 'REPLACEMENT']) type!: string;
  @IsString() @Matches(SLUG) @MaxLength(120) slug!: string;
}
export class ProductMerchandisingDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(90)
  @ValidateNested({ each: true })
  @Type(() => ProductAssociationDto)
  associations?: ProductAssociationDto[];
  @IsOptional() @IsInt() @Min(0) @Max(120) ageMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) ageMax?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  scenes?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  skills?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tags?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(/^[A-Z]{2}$/, { each: true })
  markets?: string[];
  @IsOptional() @IsDateString() publishAt?: string | null;
  @IsOptional() @IsDateString() unpublishAt?: string | null;
  @IsOptional() @IsObject() specifications?: Record<string, unknown>;
  @IsOptional() @IsObject() seo?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(20000) playGuide?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  productFaq?: Record<string, unknown>[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  gallery?: Record<string, unknown>[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  relatedSlugs?: string[];
  @IsOptional() @Matches(/^\/[a-zA-Z0-9/_-]*$/) archiveRedirect?: string;
}
export class CreateProductDto extends ProductMerchandisingDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @Matches(SLUG)
  @MaxLength(120)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ageGuidance?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  resources?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status: ProductStatus = ProductStatus.DRAFT;
}

export class UpdateProductDto extends ProductMerchandisingDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ageGuidance?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  resources?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class VariantMerchandisingDto {
  @IsOptional()
  @IsIn(['IN_STOCK_ONLY', 'PREORDER', 'BACKORDER'])
  availabilityPolicy?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) backorderLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) leadTimeDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(DB_INT_MAX) lowThreshold?: number;
  @IsOptional() @IsString() @MaxLength(60) inventorySource?: string;
  @IsOptional() @IsString() @MaxLength(500) syncError?: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsOptional() @IsObject() marketPrices?: Record<string, unknown>;
}
export class CreateVariantDto extends VariantMerchandisingDto {
  @IsString()
  @MaxLength(80)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  attrs?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  msrpCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  salePriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  b2bDefaultPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  weightGrams?: number;

  @IsOptional()
  @IsBoolean()
  status: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  sortOrder: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  available: number = 0;
}

export class UpdateVariantDto extends VariantMerchandisingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  attrs?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  msrpCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  salePriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  b2bDefaultPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  weightGrams?: number;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DB_INT_MAX)
  available?: number;
}

export class CatalogImportRowDto {
  @IsString() @Matches(SLUG) slug!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(80) sku!: string;
  @IsInt() @Min(0) @Max(DB_INT_MAX) msrpCents!: number;
  @IsInt() @Min(0) @Max(DB_INT_MAX) available!: number;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/)
  categorySlug?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tags?: string[];
}
export class CatalogImportDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CatalogImportRowDto)
  rows!: CatalogImportRowDto[];
  @IsOptional() @IsBoolean() apply: boolean = false;
}

export class CategoryTemplateDto {
  @IsArray()
  @ArrayMaxSize(80)
  @IsObject({ each: true })
  attributeTemplate!: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
  }>;
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  filterableFields!: string[];
}
export class CopyProductDto {
  @IsString() @Matches(SLUG) @MaxLength(120) slug!: string;
  @IsString() @MaxLength(80) skuPrefix!: string;
}

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
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

  @IsOptional()
  @IsString()
  parentId?: string;

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

export class CreateProductDto {
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
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status: ProductStatus = ProductStatus.DRAFT;
}

export class UpdateProductDto {
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
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class CreateVariantDto {
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

export class UpdateVariantDto {
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

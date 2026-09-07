import {
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PageQueryDto } from '../../common/pagination.dto.js';
export class ProductDetailQueryDto {
  @IsOptional() @Matches(/^[A-Z]{2}$/) market?: string;
  @IsOptional() @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/) locale?: string;
}

/** 公开商品列表查询（游客可用的字段白名单已由 Service 层控制） */
export class CatalogQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(1943)
  @Matches(/^[A-Za-z0-9_-]{1,80}(,[A-Za-z0-9_-]{1,80}){0,23}$/)
  ids?: string;
  @IsOptional() @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/) locale?: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/) market?: string;
  @IsOptional() @IsString() @MaxLength(60) scene?: string;
  @IsOptional() @IsString() @MaxLength(60) skill?: string;
  @IsOptional() @IsString() @MaxLength(60) tag?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minPrice?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  maxPrice?: number;
  @IsOptional() @IsIn(['in', 'all']) stock?: string;
  @IsOptional()
  @IsIn(['featured', 'newest', 'price-asc', 'price-desc', 'name'])
  sort?: string;
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categorySlug?: string;
}

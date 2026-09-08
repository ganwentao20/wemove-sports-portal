import { LANGUAGE_CODE } from '../../platform/locale-policy.js';
import { CmsPageStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsISO8601,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
  Max,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';

export class CmsPageQueryDto {
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{1,80}$/) productId?: string;
  @IsOptional() @Matches(LANGUAGE_CODE) locale?: string;
  @IsOptional() @IsString() @MaxLength(12) market?: string;
  @IsOptional() @IsString() @MaxLength(32) kind?: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;
}

export class CmsProductQueryDto {
  @IsOptional() @IsString() @MaxLength(64) search?: string;
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,80}(,[A-Za-z0-9_-]{1,80}){0,23}$/)
  ids?: string;
}

export class CmsMetadataDto {
  @IsOptional()
  @IsIn(['PAGE', 'ARTICLE', 'FAQ', 'BANNER', 'HOME', 'NAVIGATION'])
  kind?: string;
  @IsOptional() @Matches(LANGUAGE_CODE) locale?: string;
  @IsOptional() @IsString() @MaxLength(12) market?: string;
  @IsOptional() @IsISO8601() publishAt?: string | null;
  @IsOptional() @IsISO8601() unpublishAt?: string | null;
  @IsOptional() @IsString() @MaxLength(80) author?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ArrayUnique()
  @Matches(/^[A-Za-z0-9_-]{1,80}$/, { each: true })
  productIds?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
  @IsOptional() @IsObject() translations?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) expectedRevision?: number;
}

export class CreateCmsPageDto extends CmsMetadataDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsArray()
  sections!: unknown[];

  @IsOptional()
  @IsEnum(CmsPageStatus)
  status?: CmsPageStatus;

  @IsOptional()
  @IsObject()
  seo?: Record<string, unknown>;
}

export class UpdateCmsPageDto extends CmsMetadataDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsArray()
  sections?: unknown[];

  @IsOptional()
  @IsEnum(CmsPageStatus)
  status?: CmsPageStatus;

  @IsOptional()
  @IsObject()
  seo?: Record<string, unknown>;
}

export class SeoConfigDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  page_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  meta_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  meta_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meta_keywords?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  robots?: string;
}

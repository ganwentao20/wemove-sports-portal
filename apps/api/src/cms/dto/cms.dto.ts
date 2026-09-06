import { CmsPageStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CmsPageQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;
}

export class CreateCmsPageDto {
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

export class UpdateCmsPageDto {
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

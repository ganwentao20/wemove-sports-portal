import { LANGUAGE_CODE } from './locale-policy.js';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class SearchDto {
  @IsOptional() @IsString() @MaxLength(100) q = '';
  @IsOptional() @Matches(LANGUAGE_CODE) locale = 'en';
  @IsOptional() @IsString() @MaxLength(12) market = 'US';
  @IsOptional() @IsIn(['ALL', 'PRODUCT', 'ARTICLE', 'FAQ', 'DOWNLOAD']) type =
    'ALL';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page = 1;
}
export class SiteSettingDto {
  @IsObject() value!: Record<string, unknown>;
}
export class RedirectDto {
  @IsString() @Matches(/^\/(?!\/)[^\s?#]*$/) @MaxLength(500) source!: string;
  @IsString() @Matches(/^\/(?!\/)[^\s]*$/) @MaxLength(500) destination!: string;
  @IsOptional() @IsIn([301, 302]) status = 301;
}
export class RedirectBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RedirectDto)
  items!: RedirectDto[];
}
export class EventDto {
  @IsString()
  @IsIn([
    'view_home',
    'view_content',
    'view_product_list',
    'view_product',
    'search',
    'select_filter',
    'add_to_cart',
    'begin_checkout',
    'purchase',
    'dealer_apply_start',
    'dealer_apply_submit',
    'request_quote',
    'download_asset',
    'contact_submit',
    'newsletter_subscribe',
    'cta_click',
    'search_click',
    'page_404',
    'client_error',
    'web_vital',
  ])
  name!: string;
  @IsString() @Matches(/^\/(?!\/)/) @MaxLength(500) path!: string;
  @IsOptional() @IsObject() properties?: Record<string, unknown>;
  @IsBoolean() consent!: boolean;
}
export class NewsletterDto {
  @IsEmail() @MaxLength(160) email!: string;
  @Matches(LANGUAGE_CODE) locale = 'en';
  @IsBoolean() consent!: boolean;
  @IsString() @Length(1, 40) consentVersion!: string;
  @IsOptional() @IsString() @MaxLength(0) website?: string;
}
export class NewsletterTokenDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
}

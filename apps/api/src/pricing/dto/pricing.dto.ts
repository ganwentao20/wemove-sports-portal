import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { PricingScopeCode } from '../pricing-engine.js';

export type PricingScopeLiteral = PricingScopeCode;

const SCOPES: PricingScopeLiteral[] = [
  'COMPANY_SPECIFIC',
  'PRICE_TABLE',
  'TIER_LEVEL',
  'B2B_DEFAULT',
];

export class CreatePricingRuleDto {
  @IsString()
  variantId!: string;

  @IsEnum(SCOPES)
  scope!: PricingScopeLiteral;

  @ValidateIf((o: CreatePricingRuleDto) => o.scope === 'COMPANY_SPECIFIC')
  @IsString()
  companyId?: string;

  @ValidateIf((o: CreatePricingRuleDto) => o.scope === 'PRICE_TABLE')
  @IsString()
  bookId?: string;

  @ValidateIf((o: CreatePricingRuleDto) => o.scope === 'TIER_LEVEL')
  @IsString()
  tierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minQty: number = 1;

  @IsOptional()
  @IsBoolean()
  active: boolean = true;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdatePricingRuleDto {
  @IsOptional()
  @IsEnum(SCOPES)
  scope?: PricingScopeLiteral;

  @ValidateIf((o: UpdatePricingRuleDto) => o.scope === 'COMPANY_SPECIFIC')
  @IsString()
  companyId?: string;

  @ValidateIf((o: UpdatePricingRuleDto) => o.scope === 'PRICE_TABLE')
  @IsString()
  bookId?: string;

  @ValidateIf((o: UpdatePricingRuleDto) => o.scope === 'TIER_LEVEL')
  @IsString()
  tierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minQty?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class PricingRuleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsEnum(SCOPES)
  scope?: PricingScopeLiteral;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @IsString()
  tierId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ResolvePriceQueryDto {
  @IsString()
  variantId!: string;

  @IsString()
  companyId!: string;

  @IsOptional()
  @IsString()
  tierId?: string;

  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number = 1;
}

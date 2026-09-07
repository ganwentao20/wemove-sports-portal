import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AddCartItemDto } from '../cart/dto/cart.dto.js';

export class AddressSnapshotDto {
  @IsString() @MinLength(1) @MaxLength(120) recipient!: string;
  @IsString() @MinLength(3) @MaxLength(40) phone!: string;
  @Matches(/^[A-Z]{2}$/) country!: string;
  @IsString() @MaxLength(100) region!: string;
  @IsString() @MinLength(1) @MaxLength(100) city!: string;
  @IsString() @MinLength(1) @MaxLength(24) postalCode!: string;
  @IsString() @MinLength(1) @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
}
export class CheckoutDto {
  @IsOptional() @Matches(/^[A-Z]{2}$/) market: string = 'US';
  @IsOptional() @IsString() @MaxLength(40) couponCode?: string;
  @IsOptional() @IsIn(['STANDARD', 'EXPRESS']) shippingMethod: string =
    'STANDARD';
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  shippingAddress!: AddressSnapshotDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  billingAddress?: AddressSnapshotDto;
}
export class ManualOrderDto extends CheckoutDto {
  @IsString() @MinLength(1) userId!: string;
  @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}
export class PaymentSessionDto {
  @IsString() @MinLength(8) @MaxLength(100) idempotencyKey!: string;
}
export class PaymentEventDto {
  @IsString() @MinLength(8) @MaxLength(120) eventId!: string;
  @IsString() @MaxLength(120) paymentId!: string;
  @IsIn(['SUCCEEDED', 'FAILED', 'CANCELLED']) status!: string;
  @IsInt() @Min(0) @Max(2147483647) amountCents!: number;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsString() @MaxLength(160) providerReference!: string;
}
export class DemoPaymentDto {
  @IsIn(['SUCCEEDED', 'FAILED', 'CANCELLED']) status!: string;
}
export class QuantityLineDto {
  @IsString() @MaxLength(120) orderItemId!: string;
  @IsInt() @Min(1) @Max(999999) quantity!: number;
}
export class ShipmentDto extends PaymentSessionDto {
  @IsString() @MinLength(1) @MaxLength(100) carrier!: string;
  @IsString() @MinLength(1) @MaxLength(120) trackingNumber!: string;
  @IsOptional() @Matches(/^https:\/\//) @MaxLength(500) trackingUrl?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuantityLineDto)
  items!: QuantityLineDto[];
}
export class ReturnLineDto extends QuantityLineDto {
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class ReturnEvidenceDto {
  @IsString() @MinLength(1) @MaxLength(100) mediaId!: string;
  @IsString() @MinLength(1) @MaxLength(200) attachmentToken!: string;
  @IsString() @MinLength(1) @MaxLength(100) orderItemId!: string;
}
export class ReturnDto {
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ReturnEvidenceDto)
  attachments?: ReturnEvidenceDto[];
  @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
  @IsOptional() @IsIn(['REFUND', 'EXCHANGE']) resolution: string = 'REFUND';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items!: ReturnLineDto[];
}
export class ReturnDecisionDto {
  @IsIn(['APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED']) status!: string;
  @IsString() @MinLength(3) @MaxLength(2000) staffNote!: string;
}
export class RefundDto extends PaymentSessionDto {
  @IsInt() @Min(1) @Max(2147483647) amountCents!: number;
  @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
  @IsOptional() @IsString() returnId?: string;
}
export class RefundResultDto {
  @IsIn(['SUCCEEDED', 'FAILED']) status!: string;
  @IsString() @MinLength(3) @MaxLength(160) providerReference!: string;
}
export class ShippingRuleDto {
  @IsIn(['STANDARD', 'EXPRESS']) method!: string;
  @IsOptional() @IsInt() @Min(0) minWeightGrams?: number;
  @IsOptional() @IsInt() @Min(1) maxWeightGrams?: number;
  @IsOptional() @IsInt() @Min(0) minSubtotalCents?: number;
  @IsOptional() @IsInt() @Min(1) maxSubtotalCents?: number;
  @IsInt() @Min(0) @Max(2147483647) amountCents!: number;
}
export class MarketInventoryDto {
  @Matches(/^[A-Z]{2}$/) market!: string;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) available?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) lowThreshold?: number;
  @IsOptional() @IsString() @MaxLength(60) source?: string;
  @IsOptional() @IsString() @MaxLength(500) syncError?: string;
}
export class MarketDto {
  @IsOptional()
  @IsIn(['STATUS', 'EXACT', 'LEVEL', 'HIDDEN'])
  inventoryDisplay?: string;
  @IsOptional() @IsBoolean() allowPreorder?: boolean;
  @IsOptional() @IsBoolean() allowBackorder?: boolean;
  @IsOptional()
  @IsIn(['featured', 'newest', 'price-asc', 'price-desc', 'name'])
  defaultSort?: string;
  @IsOptional() @IsIn(['CONFIGURED', 'HTTP']) taxMode?: string;
  @IsOptional() @IsIn(['CONFIGURED', 'HTTP']) shippingMode?: string;
  @IsOptional() @IsObject() taxRegionRates?: Record<string, number>;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ShippingRuleDto)
  shippingRules?: ShippingRuleDto[];
  @Matches(/^[A-Z]{2}$/) code!: string;
  @IsString() @MinLength(1) @MaxLength(100) label!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsBoolean() retailEnabled!: boolean;
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(/^[A-Z]{2}$/, { each: true })
  countries!: string[];
  @IsInt() @Min(0) @Max(10000) taxBps!: number;
  @IsInt() @Min(0) @Max(10000000) shippingCents!: number;
  @IsInt() @Min(0) @Max(10000000) expressCents!: number;
  @IsOptional() @IsInt() @Min(0) freeShippingAboveCents?: number | null;
  @IsInt() @Min(5) @Max(1440) reservationMinutes!: number;
  @IsIn(['DEMO', 'WEBHOOK']) paymentMode!: string;
}
export class CouponDto {
  @IsOptional() @IsBoolean() freeShipping?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  productIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  userIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(1000) perUserLimit?: number | null;
  @Matches(/^[A-Z0-9_-]{3,40}$/) code!: string;
  @Matches(/^[A-Z]{2}$/) market!: string;
  @IsInt() @Min(0) @Max(10000) percentBps!: number;
  @IsInt() @Min(0) @Max(10000000) amountCents!: number;
  @IsInt() @Min(0) @Max(10000000) minimumCents!: number;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsInt() @Min(1) maxUses?: number | null;
  @IsBoolean() active!: boolean;
}
export class CartMergeDto {
  @IsArray() @ArrayMaxSize(100) @IsObject({ each: true }) items!: Array<{
    variantId: string;
    quantity: number;
  }>;
}

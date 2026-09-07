import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuickOrderDto } from './quick-order.dto.js';

// M1/MB：输入由 ValidationPipe 校验；金额上限同时在服务层累计校验。
export class CreateRfqDto extends QuickOrderDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 160)
  title!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsISO8601({ strict: true }) targetDeliveryAt?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  attachmentIds?: string[];
}
export class QuoteLineDto {
  @IsString() @Length(1, 64) sku!: string;
  @IsInt() @Min(0) @Max(2147483647) unitPriceCents!: number;
}
export class CreateQuoteDto {
  @IsInt() @Min(0) @Max(2147483647) revision!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
  @IsInt() @Min(0) @Max(2147483647) taxCents!: number;
  @IsInt() @Min(0) @Max(2147483647) shippingCents!: number;
  @IsISO8601({ strict: true }) validUntil!: string;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) discountCents?: number;
  @IsOptional() @IsString() @Length(1, 160) paymentTerms?: string;
  @IsOptional() @IsString() @MaxLength(500) deliveryTerms?: string;
}
export class ShippingAddressDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  recipient!: string;
  @IsString() @Length(3, 40) phone!: string;
  @IsString() @Length(2, 2) country!: string;
  @IsString() @Length(1, 100) city!: string;
  @IsString() @Length(1, 300) addressLine!: string;
  @IsString() @Length(1, 24) postalCode!: string;
}
export class QuoteVersionDto {
  @IsInt() @Min(1) @Max(2147483647) version!: number;
  @IsOptional() @IsString() @Length(1, 1000) reason?: string;
}
export class AcceptQuoteDto extends QuoteVersionDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  billingAddress?: ShippingAddressDto;
  @IsOptional() @IsString() @MaxLength(80) customerPoNumber?: string;
  @IsOptional()
  @IsIn(['BANK_TRANSFER', 'PO', 'ACCOUNT', 'CARD'])
  paymentMethod?: string;
}
export class PurchaseOrderStatusDto {
  @IsIn(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'])
  status!: 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  @IsOptional() @IsString() @Length(1, 1000) reason?: string;
}
export class CancelPurchaseOrderDto {
  @IsString() @Length(1, 1000) reason!: string;
}
export class AdjustPurchaseOrderDto extends CancelPurchaseOrderDto {
  @IsOptional() @IsString() @MaxLength(80) customerPoNumber?: string;
  @IsOptional() @IsString() @Length(1, 160) paymentTerms?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  billingAddress?: ShippingAddressDto;
}
export class AssignPriceBooksDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  bookIds!: string[];
}
export class CreatePriceBookDto {
  @IsString() @Length(1, 64) code!: string;
  @IsString() @Length(1, 160) label!: string;
}

export class StaffCreatePurchaseOrderDto extends AcceptQuoteDto {
  @IsString() @Length(5, 1000) staffReason!: string;
}

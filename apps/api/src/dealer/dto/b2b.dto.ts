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
}
export class AcceptQuoteDto extends QuoteVersionDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;
}
export class PurchaseOrderStatusDto {
  @IsIn(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'])
  status!: 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
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

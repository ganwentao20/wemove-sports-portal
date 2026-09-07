import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShippingAddressDto } from './b2b.dto.js';
export class ClaimDto {
  @IsString() @Length(64, 64) token!: string;
}
export class DraftDto {
  @IsObject() data!: Record<string, unknown>;
}
export class CompanyProfileDto {
  @IsString() @Length(2, 160) companyName!: string;
  @IsOptional() @IsObject() profile?: Record<string, unknown>;
}
export class InviteDto {
  @IsEmail() email!: string;
  @IsIn(['BUYER', 'VIEWER']) role!: 'BUYER' | 'VIEWER';
}
export class MemberDto {
  @IsIn(['OWNER', 'BUYER', 'VIEWER']) role!: 'OWNER' | 'BUYER' | 'VIEWER';
  @IsBoolean() active!: boolean;
}
export class CompanyAddressDto {
  @IsString() @Length(1, 80) label!: string;
  @IsIn(['BILLING', 'SHIPPING', 'BOTH', 'HEADQUARTERS']) kind!: string;
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address!: ShippingAddressDto;
}
export class CompanyPolicyDto {
  @IsObject() catalogPolicy!: Record<string, unknown>;
  @IsObject() purchaseSettings!: Record<string, unknown>;
  @IsOptional() @IsIn(['APPROVED', 'SUSPENDED', 'CLOSED']) status?:
    'APPROVED' | 'SUSPENDED' | 'CLOSED';
}
export class ShipmentLineDto {
  @IsString() @Length(1, 80) sku!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
}
export class PoShipmentDto {
  @IsString() @Length(1, 100) carrier!: string;
  @IsString() @Length(1, 100) trackingNumber!: string;
  @IsString() @Length(8, 120) dedupeKey!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ShipmentLineDto)
  lines!: ShipmentLineDto[];
}
export class CsvDto {
  @IsString() @MaxLength(100000) csv!: string;
}
export class OfflinePoPaymentDto {
  @IsInt() @Min(0) @Max(2147483647) amountCents!: number;
  @IsString() @Length(3, 160) providerReference!: string;
  @IsString() @Length(8, 120) idempotencyKey!: string;
}

export class DirectoryReviewDto {
  @IsBoolean() approve!: boolean;
  @IsString() @Length(5, 1000) reason!: string;
  @IsString() @Length(1, 80) submissionId!: string;
}

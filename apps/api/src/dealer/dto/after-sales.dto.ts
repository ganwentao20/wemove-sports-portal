import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
export class ReturnLineDto {
  @IsString() @Length(1, 100) orderItemId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
}
export class CreatePoReturnDto {
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsString() @Length(3, 1000) reason!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];
}
export class PoAfterSalesDecisionDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @IsString() @Length(3, 1000) reason!: string;
}
export class ReturnTrackingDto {
  @IsString() @Length(1, 100) carrier!: string;
  @IsString() @Length(1, 100) trackingNumber!: string;
}
export class ReceiveReturnLineDto extends ReturnLineDto {
  @IsInt() @Min(0) @Max(100000) restockQuantity!: number;
}
export class ReceivePoReturnDto {
  @IsString() @Length(8, 120) receiveKey!: string;
  @IsString() @Length(3, 1000) note!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnLineDto)
  lines!: ReceiveReturnLineDto[];
}
export class CreatePoRefundDto {
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsInt() @Min(1) @Max(2147483647) amountCents!: number;
  @IsString() @Length(3, 1000) reason!: string;
  @IsOptional() @IsString() @Length(1, 100) returnId?: string;
  @IsOptional() @IsBoolean() cancelOrder?: boolean;
}
export class ConfirmPoRefundDto {
  @IsInt() @Min(1) @Max(2147483647) amountCents!: number;
  @IsString() @Length(3, 160) providerReference!: string;
}

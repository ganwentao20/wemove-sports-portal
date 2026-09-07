import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Matches,
} from 'class-validator';

export class AddCartItemDto {
  @IsOptional() @Matches(/^[A-Z]{2}$/) market?: string;
  @IsString()
  variantId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number = 1;
}

export class UpdateCartItemDto {
  @IsOptional() @Matches(/^[A-Z]{2}$/) market?: string;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  quantity!: number;
}

export class MergeCartDto {
  @IsOptional() @Matches(/^[A-Z]{2}$/) market?: string;
  @IsString() @MinLength(8) @MaxLength(100) idempotencyKey!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}

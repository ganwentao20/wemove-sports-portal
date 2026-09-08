import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuickOrderLineDto {
  @IsString()
  @MaxLength(64)
  sku!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;
}

export class QuickOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuickOrderLineDto)
  lines!: QuickOrderLineDto[];
}

/** Affects preview labels only; business documents keep their original snapshots. */
export class QuickOrderLocaleQueryDto {
  @IsOptional()
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
  locale = 'en';
}

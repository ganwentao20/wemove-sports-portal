import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
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

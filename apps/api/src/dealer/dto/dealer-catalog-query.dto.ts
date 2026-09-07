import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

/** Authorized catalog quantity pricing and exact product lookup for the public product page. */
export class DealerCatalogQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity = 1;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  productId?: string;
}

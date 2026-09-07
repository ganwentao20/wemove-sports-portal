import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class ProductRatingDto {
  @IsBoolean() enabled!: boolean;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(5) average!: number;
  @IsInt() @Min(0) @Max(2147483647) count!: number;
  @IsString() @MaxLength(300) source!: string;
}

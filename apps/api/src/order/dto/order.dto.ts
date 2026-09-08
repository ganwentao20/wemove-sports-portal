import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { PageQueryDto } from '../../common/pagination.dto.js';

export class OrderQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class UpdateOrderStatusDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) reason?: string;
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
export class CancelOrderDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) reason?: string;
}

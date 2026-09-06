import {
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrderQueryDto } from './dto/order.dto.js';
import { OrderService } from './order.service.js';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post('checkout')
  checkout(@CurrentUser() actor: JwtPayload, @Ip() ip?: string) {
    return this.orders.checkout(actor, ip);
  }

  @Get()
  list(@CurrentUser() actor: JwtPayload, @Query() query: OrderQueryDto) {
    return this.orders.listMine(actor, query);
  }

  @Get(':id')
  detail(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.orders.getMine(actor, id);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Ip() ip?: string,
  ) {
    return this.orders.cancelMine(actor, id, ip);
  }
}

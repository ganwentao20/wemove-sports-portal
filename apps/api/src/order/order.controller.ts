import {
  Controller,
  Body,
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
import { OrderQueryDto, CancelOrderDto } from './dto/order.dto.js';
import { OrderService } from './order.service.js';
import { CommerceService } from './commerce.service.js';
import { CheckoutDto } from './commerce.dto.js';
import { CustomerOnlyGuard } from './customer-only.guard.js';

@Controller('orders')
@UseGuards(JwtAuthGuard, CustomerOnlyGuard)
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly commerce: CommerceService,
  ) {}

  @Post('checkout')
  checkout(@CurrentUser() actor: JwtPayload, @Body() dto: CheckoutDto) {
    return this.commerce.checkout(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: JwtPayload, @Query() query: OrderQueryDto) {
    return this.orders.listMine(actor, query);
  }

  @Get(':id')
  detail(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.commerce.order(actor, id);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Ip() ip?: string,
  ) {
    return this.orders.cancelMine(actor, id, ip, dto?.reason);
  }
}

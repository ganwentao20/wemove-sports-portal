import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getMyCart(@CurrentUser() actor: JwtPayload) {
    return this.cart.getMyCart(actor);
  }

  @Post('items')
  addItem(@CurrentUser() actor: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(actor, dto.variantId, dto.quantity);
  }

  @Patch('items/:variantId')
  updateQuantity(
    @CurrentUser() actor: JwtPayload,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateQuantity(actor, variantId, dto.quantity);
  }

  @Delete('items/:variantId')
  removeItem(@CurrentUser() actor: JwtPayload, @Param('variantId') variantId: string) {
    return this.cart.removeItem(actor, variantId);
  }

  @Delete()
  clear(@CurrentUser() actor: JwtPayload) {
    return this.cart.clear(actor);
  }
}
import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { OrderQueryDto, UpdateOrderStatusDto } from './dto/order.dto.js';
import { OrderService } from './order.service.js';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class OrderAdminController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.orders.listAdmin(query);
  }

  @Patch(':id/status')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  transition(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.orders.transitionAdmin(id, dto.status, actor, ip);
  }
}

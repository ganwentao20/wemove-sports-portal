import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { B2bService } from './b2b.service.js';
import {
  AcceptQuoteDto,
  AssignPriceBooksDto,
  CreatePriceBookDto,
  CreateQuoteDto,
  CreateRfqDto,
  PurchaseOrderStatusDto,
  QuoteVersionDto,
} from './dto/b2b.dto.js';

/** M1/MB：经销商采购 API，企业及成员角色由服务层实时验证。 */
@Controller('dealer')
@UseGuards(JwtAuthGuard)
export class B2bController {
  constructor(private readonly b2b: B2bService) {}
  @Get('rfqs') list(@CurrentUser() actor: JwtPayload) {
    return this.b2b.listRfqs(actor);
  }
  @Post('rfqs') create(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: CreateRfqDto,
  ) {
    return this.b2b.createRfq(actor, dto);
  }
  @Post('rfqs/:id/submit') submit(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.b2b.submitRfq(actor, id);
  }
  @Post('rfqs/:id/accept') accept(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AcceptQuoteDto,
  ) {
    return this.b2b.acceptQuote(actor, id, dto);
  }
  @Post('rfqs/:id/reject') reject(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: QuoteVersionDto,
  ) {
    return this.b2b.rejectQuote(actor, id, dto.version);
  }
  @Get('purchase-orders') orders(@CurrentUser() actor: JwtPayload) {
    return this.b2b.listOrders(actor);
  }
  @Patch('purchase-orders/:id/cancel') cancel(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.b2b.transitionOrder(actor, id, 'CANCELLED');
  }
}

/** M1/MB：后台报价/履约/授权的全部写操作要求 SUPER_ADMIN + MFA。 */
@Controller('admin/b2b')
@UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
@Roles('SUPER_ADMIN')
export class B2bAdminController {
  constructor(private readonly b2b: B2bService) {}
  @Get('rfqs') list() {
    return this.b2b.listAdminRfqs();
  }
  @Post('rfqs/:id/quotes')
  @RequireMfa()
  quote(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.b2b.quote(actor, id, dto);
  }
  @Get('purchase-orders') orders() {
    return this.b2b.listOrders();
  }
  @Patch('purchase-orders/:id/status')
  @RequireMfa()
  transition(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PurchaseOrderStatusDto,
  ) {
    return this.b2b.transitionOrder(actor, id, dto.status);
  }
  @Get('price-books') books() {
    return this.b2b.priceBookOptions();
  }
  @Post('price-books')
  @RequireMfa()
  createBook(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: CreatePriceBookDto,
  ) {
    return this.b2b.createPriceBook(actor, dto.code, dto.label);
  }
  @Put('companies/:id/price-books')
  @RequireMfa()
  assign(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignPriceBooksDto,
  ) {
    return this.b2b.assignBooks(actor, id, dto.bookIds);
  }
}

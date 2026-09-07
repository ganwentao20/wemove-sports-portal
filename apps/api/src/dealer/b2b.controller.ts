import {
  Body,
  Controller,
  Get,
  Headers,
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
import { B2bPaymentService } from './b2b-payment.service.js';
import {
  DemoPaymentDto,
  PaymentEventDto,
  PaymentSessionDto,
} from '../order/commerce.dto.js';
import { PoShipmentDto, OfflinePoPaymentDto } from './dto/portal.dto.js';
import {
  AcceptQuoteDto,
  StaffCreatePurchaseOrderDto,
  AssignPriceBooksDto,
  CreatePriceBookDto,
  CreateQuoteDto,
  CreateRfqDto,
  PurchaseOrderStatusDto,
  QuoteVersionDto,
  CancelPurchaseOrderDto,
  AdjustPurchaseOrderDto,
} from './dto/b2b.dto.js';

/** M1/MB：经销商采购 API，企业及成员角色由服务层实时验证。 */
@Controller('dealer')
@UseGuards(JwtAuthGuard)
export class B2bController {
  constructor(
    private readonly b2b: B2bService,
    private readonly payments: B2bPaymentService,
  ) {}
  @Post('purchase-orders/:id/payment-session') paymentSession(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PaymentSessionDto,
  ) {
    return this.payments.session(actor, id, dto.idempotencyKey);
  }
  @Post('payments/:id/demo') demo(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DemoPaymentDto,
  ) {
    return this.payments.demo(actor, id, dto.status);
  }
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
    return this.b2b.rejectQuote(actor, id, dto.version, dto.reason);
  }
  @Get('purchase-orders') orders(@CurrentUser() actor: JwtPayload) {
    return this.b2b.listOrders(actor);
  }
  @Post('purchase-orders/:id/reorder') reorder(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.b2b.reorder(actor, id);
  }
  @Get('purchase-orders/:id/documents/:kind') document(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
  ) {
    return this.b2b.document(actor, id, kind);
  }
  @Patch('purchase-orders/:id/cancel') cancel(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CancelPurchaseOrderDto,
  ) {
    return this.b2b.transitionOrder(actor, id, 'CANCELLED', dto.reason);
  }
}

@Controller('dealer/payments')
export class B2bPaymentWebhookController {
  constructor(private readonly payments: B2bPaymentService) {}
  @Post('webhook') webhook(
    @Body() dto: PaymentEventDto,
    @Headers('x-payment-timestamp') timestamp: string,
    @Headers('x-payment-signature') signature: string,
  ) {
    return this.payments.webhook(dto, timestamp, signature);
  }
}

/** M1/MB：后台报价/履约/授权的全部写操作要求 SUPER_ADMIN + MFA。 */
@Controller('admin/b2b')
@UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
@Roles('SUPER_ADMIN')
export class B2bAdminController {
  constructor(
    private readonly b2b: B2bService,
    private readonly payments: B2bPaymentService,
  ) {}
  @Post('purchase-orders/:id/offline-payment') @RequireMfa() payment(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: OfflinePoPaymentDto,
  ) {
    return this.payments.offline(actor, id, dto);
  }
  @Patch('purchase-orders/:id/adjust') @RequireMfa() adjust(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdjustPurchaseOrderDto,
  ) {
    return this.b2b.adjustOrder(actor, id, dto);
  }
  @Post('purchase-orders/:id/shipments') @RequireMfa() ship(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PoShipmentDto,
  ) {
    return this.b2b.ship(actor, id, dto);
  }
  @Get('purchase-orders/:id/documents/:kind') document(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
  ) {
    return this.b2b.document(actor, id, kind);
  }
  @Get('rfqs') list() {
    return this.b2b.listAdminRfqs();
  }
  @Post('rfqs/:id/purchase-order') @RequireMfa() manualOrder(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StaffCreatePurchaseOrderDto,
  ) {
    return this.b2b.createStaffOrder(actor, id, dto);
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
    return this.b2b.transitionOrder(actor, id, dto.status, dto.reason);
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

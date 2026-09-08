import { FileInterceptor } from '@nestjs/platform-express';
import { Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ReturnEvidenceService } from './return-evidence.service.js';
import type { UploadedMediaFile } from '../media/media.service.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CustomerOnlyGuard } from './customer-only.guard.js';
import { Roles, RolesGuard, Permissions } from '../rbac/roles.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import {
  CheckoutDto,
  CouponDto,
  DemoPaymentDto,
  MarketDto,
  PaymentEventDto,
  PaymentSessionDto,
  RefundDto,
  RefundResultDto,
  ReturnDecisionDto,
  ReturnDto,
  ShipmentDto,
  ManualOrderDto,
  MarketInventoryDto,
} from './commerce.dto.js';
import { CommerceService } from './commerce.service.js';
import type { Response } from 'express';
import { orderPdf } from './order-pdf.js';

@Controller('commerce')
export class CommercePublicController {
  constructor(private readonly service: CommerceService) {}
  @Get('markets') markets() {
    return this.service.markets();
  }
  @Post('payment-webhook') webhook(
    @Body() dto: PaymentEventDto,
    @Headers('x-payment-timestamp') timestamp: string,
    @Headers('x-payment-signature') signature: string,
  ) {
    return this.service.webhook(dto, timestamp, signature);
  }
}
@Controller('orders')
@UseGuards(JwtAuthGuard, CustomerOnlyGuard)
export class CommerceCustomerController {
  constructor(
    private readonly service: CommerceService,
    private readonly evidence: ReturnEvidenceService,
  ) {}
  @Post(':id/return-attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadEvidence(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
  ) {
    return this.evidence.upload(actor, id, file);
  }
  @Delete(':id/return-attachments/:mediaId')
  removeEvidence(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.evidence.remove(actor, id, mediaId);
  }
  @Get(':id/returns/:returnId/attachments/:mediaId/access')
  returnEvidence(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('returnId') returnId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.evidence.access(actor, id, returnId, mediaId);
  }
  @Get(':id/documents/:kind/pdf') async pdf(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Res() response: Response,
  ) {
    const data = await this.service.document(actor, id, kind);
    response
      .type('application/pdf')
      .attachment(`${data.number}.pdf`)
      .send(await orderPdf(data));
  }
  @Post('quote') quote(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: CheckoutDto,
  ) {
    return this.service.quote(actor, dto);
  }
  @Post(':id/payment-session') session(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PaymentSessionDto,
  ) {
    return this.service.paymentSession(actor, id, dto.idempotencyKey);
  }
  @Post('payments/:id/demo') demo(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DemoPaymentDto,
  ) {
    return this.service.demoPayment(actor, id, dto.status);
  }
  @Post(':id/returns') returns(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReturnDto,
  ) {
    return this.service.requestReturn(actor, id, dto);
  }
  @Post(':id/reorder') reorder(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.reorder(actor, id);
  }
  @Get(':id/documents/:kind') document(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
  ) {
    return this.service.document(actor, id, kind);
  }
}
@Controller('admin/commerce')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CommerceAdminController {
  constructor(
    private readonly service: CommerceService,
    private readonly evidence: ReturnEvidenceService,
  ) {}
  @Get('orders/:id/returns/:returnId/attachments/:mediaId/access')
  @Permissions('order:read')
  returnEvidence(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('returnId') returnId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.evidence.access(actor, id, returnId, mediaId);
  }
  @Get('orders/:id/documents/:kind/pdf') async pdf(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Res() response: Response,
  ) {
    const data = await this.service.document(actor, id, kind);
    response
      .type('application/pdf')
      .attachment(`${data.number}.pdf`)
      .send(await orderPdf(data));
  }
  @Post('orders') @UseGuards(RequireMfaGuard) @RequireMfa() manual(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: ManualOrderDto,
  ) {
    return this.service.manualOrder(actor, dto);
  }
  @Get('customers') customers(@Query('search') search?: string) {
    return this.service.customers(search?.slice(0, 100));
  }
  @Get('order-catalog') catalog() {
    return this.service.manualCatalog();
  }
  @Get('markets') markets() {
    return this.service.markets();
  }
  @Get('coupons') coupons() {
    return this.service.coupons();
  }
  @Get('inventory-alerts') @Permissions('catalog:product:read') alerts() {
    return this.service.inventoryAlerts();
  }
  @Post('inventory/:variantId')
  @Permissions('catalog:product:write')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  inventory(
    @CurrentUser() actor: JwtPayload,
    @Param('variantId') variantId: string,
    @Body() dto: MarketInventoryDto,
  ) {
    return this.service.saveInventory(actor, variantId, dto);
  }
  @Post('markets')
  @Permissions('system:settings:write')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  market(@CurrentUser() actor: JwtPayload, @Body() dto: MarketDto) {
    return this.service.saveMarket(dto, actor);
  }
  @Post('coupons')
  @Permissions('catalog:price:write')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  coupon(@CurrentUser() actor: JwtPayload, @Body() dto: CouponDto) {
    return this.service.saveCoupon(dto, actor);
  }
  @Post('expire-reservations')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  expire() {
    return this.service.expire();
  }
  @Post('orders/:id/shipments')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  shipment(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ShipmentDto,
  ) {
    return this.service.shipment(actor, id, dto);
  }
  @Patch('returns/:id') @UseGuards(RequireMfaGuard) @RequireMfa() returns(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReturnDecisionDto,
  ) {
    return this.service.returnDecision(actor, id, dto);
  }
  @Post('returns/:id/exchange-shipment')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  exchange(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ShipmentDto,
  ) {
    return this.service.exchangeShipment(actor, id, dto);
  }
  @Post('orders/:id/refunds') @UseGuards(RequireMfaGuard) @RequireMfa() refund(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RefundDto,
  ) {
    return this.service.refund(actor, id, dto);
  }
  @Patch('refunds/:id/result')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  refundResult(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RefundResultDto,
  ) {
    return this.service.refundResult(
      actor,
      id,
      dto.status,
      dto.providerReference,
    );
  }
  @Get('orders/:id') detail(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.order(actor, id);
  }
  @Get('orders/:id/documents/:kind') document(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
  ) {
    return this.service.document(actor, id, kind);
  }
}

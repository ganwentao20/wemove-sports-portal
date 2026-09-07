import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { B2bAfterSalesService } from './b2b-after-sales.service.js';
import {
  CreatePoReturnDto,
  PoAfterSalesDecisionDto,
  ReturnTrackingDto,
  ReceivePoReturnDto,
  CreatePoRefundDto,
  ConfirmPoRefundDto,
} from './dto/after-sales.dto.js';
import { CancelPurchaseOrderDto } from './dto/b2b.dto.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
@Controller('dealer')
@UseGuards(JwtAuthGuard)
export class B2bAfterSalesController {
  constructor(private readonly service: B2bAfterSalesService) {}
  private customer(actor: JwtPayload) {
    if (actor.kind !== 'customer')
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'Use the authorized staff after-sales endpoint',
        403,
      );
    return actor;
  }
  @Get('purchase-orders/:id/after-sales') list(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.list(this.customer(a), id);
  }
  @Post('purchase-orders/:id/returns') requestReturn(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CreatePoReturnDto,
  ) {
    return this.service.createReturn(this.customer(a), id, d);
  }
  @Post('returns/:id/tracking') track(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: ReturnTrackingDto,
  ) {
    return this.service.trackReturn(this.customer(a), id, d);
  }
  @Post('returns/:id/cancel') cancel(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CancelPurchaseOrderDto,
  ) {
    return this.service.cancelReturn(this.customer(a), id, d.reason);
  }
  @Post('purchase-orders/:id/refunds') requestRefund(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CreatePoRefundDto,
  ) {
    return this.service.createRefund(this.customer(a), id, d);
  }
  @Post('refunds/:id/cancel') cancelRefund(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CancelPurchaseOrderDto,
  ) {
    return this.service.cancelRefund(this.customer(a), id, d.reason);
  }
}
@Controller('admin/b2b')
@UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
@Roles('SUPER_ADMIN')
export class B2bAfterSalesAdminController {
  constructor(private readonly service: B2bAfterSalesService) {}
  @Get('purchase-orders/:id/after-sales') list(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.list(a, id);
  }
  @Post('purchase-orders/:id/returns') @RequireMfa() requestReturn(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CreatePoReturnDto,
  ) {
    return this.service.createReturn(a, id, d);
  }
  @Post('returns/:id/decision') @RequireMfa() decide(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: PoAfterSalesDecisionDto,
  ) {
    return this.service.decideReturn(a, id, d);
  }
  @Post('returns/:id/receive') @RequireMfa() receive(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: ReceivePoReturnDto,
  ) {
    return this.service.receiveReturn(a, id, d);
  }
  @Post('returns/:id/tracking') @RequireMfa() track(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: ReturnTrackingDto,
  ) {
    return this.service.trackReturn(a, id, d);
  }
  @Post('purchase-orders/:id/refunds') @RequireMfa() requestRefund(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CreatePoRefundDto,
  ) {
    return this.service.createRefund(a, id, d);
  }
  @Post('refunds/:id/decision') @RequireMfa() decideRefund(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: PoAfterSalesDecisionDto,
  ) {
    return this.service.decideRefund(a, id, d);
  }
  @Post('refunds/:id/offline-confirm') @RequireMfa() offline(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: ConfirmPoRefundDto,
  ) {
    return this.service.confirmOfflineRefund(a, id, d);
  }
  @Post('refunds/:id/retry') @RequireMfa() retry(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.retryRefund(a, id);
  }
}

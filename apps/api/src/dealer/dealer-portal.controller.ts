import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { DealerPortalService } from './dealer-portal.service.js';
import { DealerService } from './dealer.service.js';
import { B2bService } from './b2b.service.js';
import {
  ClaimDto,
  CompanyAddressDto,
  CompanyPolicyDto,
  CompanyProfileDto,
  DirectoryReviewDto,
  CsvDto,
  DraftDto,
  InviteDto,
  MemberDto,
} from './dto/portal.dto.js';
import { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';
import {
  QuickOrderDto,
  QuickOrderLocaleQueryDto,
} from './dto/quick-order.dto.js';
import { parseQuickOrderCsv } from './catalog-policy.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
@Controller('dealer')
@UseGuards(JwtAuthGuard)
export class DealerPortalController {
  constructor(
    private readonly portal: DealerPortalService,
    private readonly dealer: DealerService,
    private readonly b2b: B2bService,
  ) {}
  @Get('applications') applications(@CurrentUser() a: JwtPayload) {
    return this.portal.applications(a);
  }
  @Post('applications/:id/claim') claim(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: ClaimDto,
  ) {
    return this.portal.claim(a, id, d.token);
  }
  @Post('applications/:id/resubmit') resubmit(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CreateDealerApplicationDto,
    @Ip() ip?: string,
  ) {
    return this.portal.resubmit(a, id, d, ip);
  }
  @Post('applications/:id/claim-link') resendClaim(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.portal.resendClaim(a, id);
  }
  @Delete('application-draft') clearDraft(@CurrentUser() a: JwtPayload) {
    return this.portal.clearDraft(a);
  }
  @Get('application-draft') draft(@CurrentUser() a: JwtPayload) {
    return this.portal.draft(a);
  }
  @Put('application-draft') saveDraft(
    @CurrentUser() a: JwtPayload,
    @Body() d: DraftDto,
  ) {
    return this.portal.draft(a, d.data);
  }
  @Get('dashboard') dashboard(@CurrentUser() a: JwtPayload) {
    return this.portal.dashboard(a);
  }
  @Get('company') company(@CurrentUser() a: JwtPayload) {
    return this.portal.overview(a);
  }
  @Patch('company') profile(
    @CurrentUser() a: JwtPayload,
    @Body() d: CompanyProfileDto,
  ) {
    return this.portal.profile(a, d);
  }
  @Post('company/addresses') address(
    @CurrentUser() a: JwtPayload,
    @Body() d: CompanyAddressDto,
  ) {
    return this.portal.address(a, d);
  }
  @Put('company/addresses/:id') updateAddress(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CompanyAddressDto,
  ) {
    return this.portal.address(a, d, id);
  }
  @Delete('company/addresses/:id') deleteAddress(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.portal.removeAddress(a, id);
  }
  @Post('company/invitations') invite(
    @CurrentUser() a: JwtPayload,
    @Body() d: InviteDto,
  ) {
    return this.portal.invite(a, d);
  }
  @Post('invitations/accept') accept(
    @CurrentUser() a: JwtPayload,
    @Body() d: ClaimDto,
  ) {
    return this.portal.acceptInvitation(a, d.token);
  }
  @Patch('company/members/:id') member(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: MemberDto,
  ) {
    return this.portal.member(a, id, d);
  }
  @Post('quick-order/csv') csv(
    @CurrentUser() a: JwtPayload,
    @Body() d: CsvDto,
    @Query() query: QuickOrderLocaleQueryDto,
  ) {
    let lines;
    try {
      lines = parseQuickOrderCsv(d.csv);
    } catch (e) {
      throw new BizException(ERROR_CODES.VALIDATION, (e as Error).message, 422);
    }
    return this.dealer.validateQuickOrder(lines, a, query.locale);
  }
  @Get('cart') cart(@CurrentUser() a: JwtPayload) {
    return this.b2b.cart(a);
  }
  @Put('cart') saveCart(
    @CurrentUser() a: JwtPayload,
    @Body() d: QuickOrderDto,
  ) {
    return this.b2b.cart(a, d.lines);
  }
}
@Controller('admin/b2b/companies')
@UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
@Roles('SUPER_ADMIN')
export class DealerCompanyAdminController {
  constructor(private readonly portal: DealerPortalService) {}
  @Get('policy/options') options() {
    return this.portal.policyOptions();
  }
  @Get(':id') overview(@CurrentUser() a: JwtPayload, @Param('id') id: string) {
    return this.portal.overview(a, id);
  }
  @Post(':id/directory-review') @RequireMfa() reviewDirectory(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() input: DirectoryReviewDto,
  ) {
    return this.portal.reviewDirectory(a, id, input);
  }
  @Patch(':id') @RequireMfa() profile(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CompanyProfileDto,
  ) {
    return this.portal.profile(a, d, id);
  }
  @Post(':id/addresses') @RequireMfa() address(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CompanyAddressDto,
  ) {
    return this.portal.address(a, d, undefined, id);
  }
  @Put(':id/addresses/:addressId') @RequireMfa() updateAddress(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() d: CompanyAddressDto,
  ) {
    return this.portal.address(a, d, addressId, id);
  }
  @Delete(':id/addresses/:addressId') @RequireMfa() deleteAddress(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Param('addressId') addressId: string,
  ) {
    return this.portal.removeAddress(a, addressId, id);
  }
  @Post(':id/invitations') @RequireMfa() invite(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: InviteDto,
  ) {
    return this.portal.invite(a, d, id);
  }
  @Patch(':id/members/:userId') @RequireMfa() member(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() d: MemberDto,
  ) {
    return this.portal.member(a, userId, d, id);
  }
  @Get() list() {
    return this.portal.policies();
  }
  @Put(':id/policy') @RequireMfa() policy(
    @CurrentUser() a: JwtPayload,
    @Param('id') id: string,
    @Body() d: CompanyPolicyDto,
  ) {
    return this.portal.policy(a, id, d);
  }
}

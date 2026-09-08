import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions, RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { AccountService } from './account.service.js';
import {
  AccountAdminQueryDto,
  AccountMfaCodeDto,
  AccountMfaSetupDto,
  AccountPasswordDto,
  AddressDto,
  PrivacyRequestDto,
  ProfileDto,
  ResolvePrivacyDto,
  UserStatusDto,
  ResetAccountMfaDto,
} from './account.dto.js';
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly service: AccountService) {}
  @Get('profile') profile(@CurrentUser() u: JwtPayload) {
    return this.service.profile(u);
  }
  @Patch('profile') update(
    @CurrentUser() u: JwtPayload,
    @Body() d: ProfileDto,
  ) {
    return this.service.updateProfile(u, d);
  }
  @Get('addresses') addresses(@CurrentUser() u: JwtPayload) {
    return this.service.addresses(u);
  }
  @Post('addresses') address(
    @CurrentUser() u: JwtPayload,
    @Body() d: AddressDto,
  ) {
    return this.service.saveAddress(u, d);
  }
  @Patch('addresses/:id') editAddress(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() d: AddressDto,
  ) {
    return this.service.saveAddress(u, d, id);
  }
  @Delete('addresses/:id') removeAddress(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.deleteAddress(u, id);
  }
  @Get('favorites') favorites(@CurrentUser() u: JwtPayload, @Query('locale') locale = 'en') {
    return this.service.favorites(u, locale);
  }
  @Post('favorites/:id') favorite(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.favorite(u, id);
  }
  @Delete('favorites/:id') removeFavorite(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.favorite(u, id, true);
  }
  @Get('sessions') sessions(@CurrentUser() u: JwtPayload) {
    return this.service.sessions(u);
  }
  @Delete('sessions') revokeOthers(@CurrentUser() u: JwtPayload) {
    return this.service.revokeSessions(u);
  }
  @Delete('sessions/:id') revoke(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.revokeSessions(u, id);
  }
  @Post('password') password(
    @CurrentUser() u: JwtPayload,
    @Body() d: AccountPasswordDto,
  ) {
    return this.service.changePassword(u, d);
  }
  @Get('export') export(@CurrentUser() u: JwtPayload) {
    return this.service.exportData(u);
  }
  @Get('privacy-requests') privacy(@CurrentUser() u: JwtPayload) {
    return this.service.privacyRequests(u);
  }
  @Post('deletion-request') deletion(
    @CurrentUser() u: JwtPayload,
    @Body() d: PrivacyRequestDto,
  ) {
    return this.service.requestDeletion(u, d);
  }
  @Post('mfa/setup') setup(
    @CurrentUser() u: JwtPayload,
    @Body() d: AccountMfaSetupDto,
  ) {
    return this.service.setupMfa(u, d.password);
  }
  @Post('mfa/confirm') confirm(
    @CurrentUser() u: JwtPayload,
    @Body() d: AccountMfaCodeDto,
  ) {
    return this.service.confirmMfa(u, d.code);
  }
  @Post('mfa/disable') disable(
    @CurrentUser() u: JwtPayload,
    @Body() d: AccountMfaCodeDto,
  ) {
    return this.service.confirmMfa(u, d.code, true);
  }
}
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
export class AccountAdminController {
  constructor(private readonly service: AccountService) {}
  @Get() @Permissions('user:read') list(@Query() query: AccountAdminQueryDto) {
    return this.service.listUsers(query);
  }
  @Get('privacy-requests') @Permissions('user:read') privacy() {
    return this.service.listPrivacyRequests();
  }
  @Get(':id') @Permissions('user:read') detail(@Param('id') id: string) {
    return this.service.adminUser(id);
  }
  @Post(':id/password-reset')
  @Permissions('user:write')
  @RequireMfa()
  passwordReset(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.service.requestPasswordReset(u, id);
  }
  @Post(':id/mfa-reset') @Permissions('user:write') @RequireMfa() resetMfa(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() d: ResetAccountMfaDto,
  ) {
    return this.service.resetCustomerMfa(u, id, d.reason);
  }
  @Patch(':id/status') @Permissions('user:write') @RequireMfa() status(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() d: UserStatusDto,
  ) {
    return this.service.setUserStatus(u, id, d.status, d.reason);
  }
  @Patch('privacy-requests/:id')
  @Permissions('user:write')
  @RequireMfa()
  resolve(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() d: ResolvePrivacyDto,
  ) {
    return this.service.resolvePrivacy(u, id, d);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PlatformService, csv } from './platform.service.js';
import {
  EventDto,
  NewsletterDto,
  NewsletterTokenDto,
  RedirectBatchDto,
  RedirectDto,
  SearchDto,
  SiteSettingDto,
} from './platform.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions, RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { NotificationsService } from '../notifications/notifications.service.js';
@Controller()
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly notifications: NotificationsService,
  ) {}
  @Get('site/config') config() {
    return this.platform.publicSettings();
  }
  @Get('search') search(@Query() input: SearchDto) {
    return this.platform.search(input);
  }
  @Post('analytics/events') event(@Body() input: EventDto) {
    return this.platform.event(input);
  }
  @Post('newsletter') subscribe(@Body() input: NewsletterDto) {
    return this.platform.subscribe(input);
  }
  @Post('newsletter/confirm') confirm(@Body() input: NewsletterTokenDto) {
    return this.platform.subscriptionToken(input.token);
  }
  @Post('newsletter/unsubscribe') unsubscribe(
    @Body() input: NewsletterTokenDto,
  ) {
    return this.platform.subscriptionToken(input.token, true);
  }
  @Get('site/redirect') redirect(@Query('source') source: string) {
    return this.platform.redirect(String(source ?? '').slice(0, 500));
  }
  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('system:settings:write')
  settings() {
    return this.platform.settings();
  }
  @Put('admin/settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Permissions('system:settings:write')
  @RequireMfa()
  save(
    @Param('key') key: string,
    @Body() input: SiteSettingDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.platform.saveSetting(key, input.value, actor);
  }
  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:read')
  reports(@CurrentUser() actor: JwtPayload) {
    return this.platform.reports(actor);
  }
  @Get('admin/reports/export')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Permissions('reports:read')
  @RequireMfa()
  async export(@CurrentUser() actor: JwtPayload, @Res() response: Response) {
    const report = await this.platform.reports(actor);
    const rows = Object.entries(report.metrics).flatMap(([section, items]) =>
      items.map((row) => ({ section, ...row })),
    );
    response
      .type('text/csv')
      .attachment('operations-report.csv')
      .send(csv(rows));
  }
  @Get('admin/seo/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('cms:read')
  seo() {
    return this.platform.seoAudit();
  }
  @Get('admin/seo/redirects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('cms:read')
  redirects() {
    return this.platform.redirects();
  }
  @Post('admin/seo/redirects')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Permissions('cms:write')
  @RequireMfa()
  saveRedirect(@Body() input: RedirectDto, @CurrentUser() actor: JwtPayload) {
    return this.platform.saveRedirect(input, actor);
  }
  @Post('admin/seo/redirects/import')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Permissions('cms:write')
  @RequireMfa()
  importRedirects(
    @Body() input: RedirectBatchDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.platform.importRedirects(input.items, actor);
  }
  @Get('admin/notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('system:settings:write')
  notificationsList() {
    return this.notifications.list();
  }
  @Post('admin/notifications/:id/retry')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Permissions('system:settings:write')
  @RequireMfa()
  retry(@Param('id') id: string) {
    return this.notifications.retry(id);
  }
}

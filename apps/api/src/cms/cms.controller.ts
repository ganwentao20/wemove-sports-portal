import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CmsService } from './cms.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import {
  CmsPageQueryDto,
  CreateCmsPageDto,
  SeoConfigDto,
  UpdateCmsPageDto,
} from './dto/cms.dto.js';

@Controller()
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('cms/pages')
  list(@Query() query: CmsPageQueryDto) {
    return this.cms.listPublishedPages(query.slug);
  }

  @Get('cms/pages/:id')
  detail(@Param('id') id: string) {
    return this.cms.getPublishedPage(id);
  }

  @Get('admin/cms/pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  adminList() {
    return this.cms.listPages();
  }

  @Post('cms/pages')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  create(
    @Body() dto: CreateCmsPageDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.cms.createPage(dto, actor, ip);
  }

  @Patch('cms/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCmsPageDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.cms.updatePage(id, dto, actor, ip);
  }

  @Delete('cms/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.cms.deletePage(id, actor, ip);
  }

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  dashboardStats() {
    return this.cms.dashboardStats();
  }

  @Get('api/dashboard/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  legacyDashboardStats() {
    return this.cms.dashboardStats();
  }

  @Get('articles')
  articles() {
    return this.cms.legacyArticles();
  }

  @Get('faqs')
  faqs() {
    return this.cms.legacyFaqs();
  }

  @Get('announcements')
  announcements() {
    return this.cms.legacyAnnouncements();
  }

  @Get('seo')
  seo() {
    return this.cms.seoConfig();
  }

  @Post('seo')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  createSeo(
    @Body() dto: SeoConfigDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.cms.createSeo(dto, actor, ip);
  }

  @Patch('seo/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  updateSeo(
    @Param('id') id: string,
    @Body() dto: SeoConfigDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.cms.updateSeo(id, dto, actor, ip);
  }
}

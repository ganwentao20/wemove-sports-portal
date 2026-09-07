import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseIntPipe,
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
  CmsProductQueryDto,
  CreateCmsPageDto,
  SeoConfigDto,
  UpdateCmsPageDto,
} from './dto/cms.dto.js';

@Controller()
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('admin/cms/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  productReferences(@Query() query: CmsProductQueryDto) {
    return this.cms.productReferences(query.search, query.ids);
  }

  @Get('cms/pages')
  list(@Query() query: CmsPageQueryDto) {
    return this.cms.listPublishedPages(
      query.slug,
      query.locale,
      query.market,
      query.kind,
      query.productId,
    );
  }

  @Get('cms/pages/:id')
  detail(@Param('id') id: string, @Query() query: CmsPageQueryDto) {
    return this.cms.getPublishedPage(id, query.locale, query.market);
  }

  @Get('admin/cms/pages/:id/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  preview(@Param('id') id: string) {
    return this.cms.preview(id);
  }

  @Get('admin/cms/pages/:id/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  versions(@Param('id') id: string) {
    return this.cms.versions(id);
  }

  @Post('admin/cms/pages/:id/restore/:revision')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
  @Roles('SUPER_ADMIN')
  @RequireMfa()
  restore(
    @Param('id') id: string,
    @Param('revision', ParseIntPipe) revision: number,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.cms.restore(id, revision, actor, ip);
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

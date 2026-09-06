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
import { CmsService } from './cms.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';

class CmsPageQueryDto {
  slug?: string;
  status?: 'DRAFT' | 'PUBLISHED';
}

class CmsPageDto {
  slug?: string;
  title?: string;
  sections?: unknown;
  status?: 'DRAFT' | 'PUBLISHED';
  seo?: unknown;
}

@Controller()
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('cms/pages')
  list(@Query() query: CmsPageQueryDto) {
    if (query?.slug) {
      return this.cms.listPages().then((pages: any[]) => pages.filter((page: any) => page.slug === query.slug));
    }
    return this.cms.listPages();
  }

  @Get('cms/pages/:id')
  detail(@Param('id') id: string) {
    return this.cms.getPage(id);
  }

  @Post('cms/pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CmsPageDto) {
    return this.cms.createPage(dto);
  }

  @Patch('cms/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() dto: CmsPageDto) {
    return this.cms.updatePage(id, dto);
  }

  @Delete('cms/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.cms.deletePage(id);
  }

  @Get('dashboard/stats')
  dashboardStats() {
    return this.cms.dashboardStats();
  }

  @Get('api/dashboard/stats')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  createSeo(@Body() dto: Record<string, string>) {
    return this.cms.createSeo(dto);
  }

  @Patch('seo/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  updateSeo(@Param('id') id: string, @Body() dto: Record<string, string>) {
    return this.cms.updateSeo(id, dto);
  }
}

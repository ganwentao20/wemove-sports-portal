import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type {
  CreateCmsPageDto,
  SeoConfigDto,
  UpdateCmsPageDto,
} from './dto/cms.dto.js';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async dashboardStats() {
    const [articles, faqs, leads, media] = await Promise.all([
      this.prisma.cmsPage.count({
        where: { slug: { contains: 'article' }, status: 'PUBLISHED' },
      }),
      this.prisma.cmsPage.count({
        where: { slug: { contains: 'faq' }, status: 'PUBLISHED' },
      }),
      this.prisma.contactMessage.count(),
      this.prisma.mediaAsset.count(),
    ]);

    return { articles, faqs, leads, media };
  }

  async listPages() {
    return this.prisma.cmsPage.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listPublishedPages(slug?: string) {
    return this.prisma.cmsPage.findMany({
      where: { status: 'PUBLISHED', ...(slug ? { slug } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPublishedPage(id: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { id, status: 'PUBLISHED' },
    });
    if (!page) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cms page not found', 404);
    }
    return page;
  }

  async createPage(input: CreateCmsPageDto, actor: JwtPayload, ip?: string) {
    const page = await this.prisma.cmsPage.create({
      data: {
        slug: input.slug.trim(),
        title: input.title.trim(),
        sections: input.sections as Prisma.InputJsonValue,
        status: input.status ?? 'DRAFT',
        seo: (input.seo ?? {}) as Prisma.InputJsonValue,
      },
    });
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'cms.page.create',
      entityType: 'cmsPage',
      entityId: page.id,
      after: { slug: page.slug, status: page.status },
      ip,
    });
    return page;
  }

  async updatePage(
    id: string,
    input: UpdateCmsPageDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const exists = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!exists) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cms page not found', 404);
    }

    const page = await this.prisma.cmsPage.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.sections !== undefined
          ? { sections: input.sections as Prisma.InputJsonValue }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.seo !== undefined
          ? { seo: input.seo as Prisma.InputJsonValue }
          : {}),
      },
    });
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'cms.page.update',
      entityType: 'cmsPage',
      entityId: id,
      before: { slug: exists.slug, title: exists.title, status: exists.status },
      after: { slug: page.slug, title: page.title, status: page.status },
      ip,
    });
    return page;
  }

  async deletePage(id: string, actor: JwtPayload, ip?: string) {
    const exists = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!exists) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cms page not found', 404);
    }
    await this.prisma.cmsPage.delete({ where: { id } });
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'cms.page.delete',
      entityType: 'cmsPage',
      entityId: id,
      before: { slug: exists.slug, title: exists.title, status: exists.status },
      ip,
    });
    return { ok: true };
  }

  async legacyArticles() {
    const pages = await this.prisma.cmsPage.findMany({
      where: { slug: { contains: 'article' }, status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
    });

    return pages.map((page: any) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      content: page.sections,
      created_at: page.createdAt,
      updated_at: page.updatedAt,
    }));
  }

  async legacyFaqs() {
    const pages = await this.prisma.cmsPage.findMany({
      where: { slug: { contains: 'faq' }, status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
    });

    return pages.map((page: any) => ({
      id: page.id,
      question: page.title,
      answer: Array.isArray(page.sections)
        ? JSON.stringify(page.sections)
        : String(page.sections ?? ''),
      category: page.slug,
      created_at: page.createdAt,
      updated_at: page.updatedAt,
    }));
  }

  async legacyAnnouncements() {
    const pages = await this.prisma.cmsPage.findMany({
      where: { slug: { contains: 'announcement' }, status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
    });

    return pages.map((page: any) => ({
      id: page.id,
      title: page.title,
      content: Array.isArray(page.sections)
        ? JSON.stringify(page.sections)
        : String(page.sections ?? ''),
      active: page.status === 'PUBLISHED',
      created_at: page.createdAt,
      updated_at: page.updatedAt,
    }));
  }

  async seoConfig() {
    const pages = await this.prisma.cmsPage.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
    });

    return pages.map((page: any) => ({
      id: page.id,
      page_key: page.slug,
      slug: page.slug,
      title: page.title,
      meta_title: page.title,
      meta_description:
        typeof page.seo === 'object' && page.seo && 'description' in page.seo
          ? String((page.seo as Record<string, unknown>).description ?? '')
          : '',
      meta_keywords:
        typeof page.seo === 'object' && page.seo && 'keywords' in page.seo
          ? String((page.seo as Record<string, unknown>).keywords ?? '')
          : '',
      robots:
        typeof page.seo === 'object' && page.seo && 'robots' in page.seo
          ? String((page.seo as Record<string, unknown>).robots ?? '')
          : '',
      updated_at: page.updatedAt,
    }));
  }

  async createSeo(data: SeoConfigDto, actor: JwtPayload, ip?: string) {
    const slug = data.page_key ?? `seo-${Date.now()}`;
    const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
    if (page) {
      return this.updateSeo(page.id, data, actor, ip);
    }

    const created = await this.prisma.cmsPage.create({
      data: {
        slug,
        title: data.meta_title ?? slug,
        sections: [],
        seo: {
          description: data.meta_description ?? '',
          keywords: data.meta_keywords ?? '',
          robots: data.robots ?? '',
        },
      },
    });
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'seo.create',
      entityType: 'cmsPage',
      entityId: created.id,
      after: { slug: created.slug, seo: created.seo },
      ip,
    });
    return created;
  }

  async updateSeo(
    id: string,
    data: SeoConfigDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const page = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!page) {
      throw new NotFoundException('seo page not found');
    }

    const updated = await this.prisma.cmsPage.update({
      where: { id },
      data: {
        slug: data.page_key ?? page.slug,
        title: data.meta_title ?? page.title,
        seo: {
          ...(typeof page.seo === 'object' && page.seo
            ? (page.seo as Record<string, unknown>)
            : {}),
          description: data.meta_description ?? '',
          keywords: data.meta_keywords ?? '',
          robots: data.robots ?? '',
        },
      },
    });
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'seo.update',
      entityType: 'cmsPage',
      entityId: id,
      before: { slug: page.slug, seo: page.seo },
      after: { slug: updated.slug, seo: updated.seo },
      ip,
    });
    return updated;
  }
}

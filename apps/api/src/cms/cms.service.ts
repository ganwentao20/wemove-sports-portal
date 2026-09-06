import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';

export type CmsPageUpsertDto = {
  slug?: string;
  title?: string;
  sections?: unknown;
  status?: 'DRAFT' | 'PUBLISHED';
  seo?: unknown;
};

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardStats() {
    const [articles, faqs, leads, media] = await Promise.all([
      this.prisma.cmsPage.count({ where: { slug: { contains: 'article' } } }),
      this.prisma.cmsPage.count({ where: { slug: { contains: 'faq' } } }),
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

  async getPage(id: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!page) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cms page not found', 404);
    }
    return page;
  }

  async createPage(input: CmsPageUpsertDto) {
    const slug = input.slug ?? `page-${Date.now()}`;
    return this.prisma.cmsPage.create({
      data: {
        slug,
        title: input.title ?? slug,
        sections: input.sections ?? [],
        status: input.status ?? 'DRAFT',
        seo: input.seo ?? {},
      },
    });
  }

  async updatePage(id: string, input: CmsPageUpsertDto) {
    const exists = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!exists) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cms page not found', 404);
    }

    return this.prisma.cmsPage.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.sections !== undefined
          ? { sections: input.sections === null ? Prisma.JsonNull : input.sections }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.seo !== undefined
          ? { seo: input.seo === null ? Prisma.JsonNull : input.seo }
          : {}),
      },
    });
  }

  async deletePage(id: string) {
    const exists = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!exists) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'cms page not found', 404);
    }
    await this.prisma.cmsPage.delete({ where: { id } });
    return { ok: true };
  }

  async legacyArticles() {
    const pages = await this.prisma.cmsPage.findMany({
      where: { slug: { contains: 'article' } },
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
      where: { slug: { contains: 'faq' } },
      orderBy: { updatedAt: 'desc' },
    });

    return pages.map((page: any) => ({
      id: page.id,
      question: page.title,
      answer: Array.isArray(page.sections) ? JSON.stringify(page.sections) : String(page.sections ?? ''),
      category: page.slug,
      created_at: page.createdAt,
      updated_at: page.updatedAt,
    }));
  }

  async legacyAnnouncements() {
    const pages = await this.prisma.cmsPage.findMany({
      where: { slug: { contains: 'announcement' } },
      orderBy: { updatedAt: 'desc' },
    });

    return pages.map((page: any) => ({
      id: page.id,
      title: page.title,
      content: Array.isArray(page.sections) ? JSON.stringify(page.sections) : String(page.sections ?? ''),
      active: page.status === 'PUBLISHED',
      created_at: page.createdAt,
      updated_at: page.updatedAt,
    }));
  }

  async seoConfig() {
    const pages = await this.prisma.cmsPage.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return pages.map((page: any) => ({
      id: page.id,
      page_key: page.slug,
      slug: page.slug,
      title: page.title,
      meta_title: page.title,
      meta_description: typeof page.seo === 'object' && page.seo && 'description' in page.seo ? String((page.seo as Record<string, unknown>).description ?? '') : '',
      meta_keywords: typeof page.seo === 'object' && page.seo && 'keywords' in page.seo ? String((page.seo as Record<string, unknown>).keywords ?? '') : '',
      robots: typeof page.seo === 'object' && page.seo && 'robots' in page.seo ? String((page.seo as Record<string, unknown>).robots ?? '') : '',
      updated_at: page.updatedAt,
    }));
  }

  async createSeo(data: { page_key?: string; meta_title?: string; meta_description?: string; meta_keywords?: string; robots?: string }) {
    const slug = data.page_key ?? `seo-${Date.now()}`;
    const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
    if (page) {
      return this.prisma.cmsPage.update({
        where: { id: page.id },
        data: {
          title: data.meta_title ?? page.title,
          seo: {
            description: data.meta_description ?? '',
            keywords: data.meta_keywords ?? '',
            robots: data.robots ?? '',
          },
        },
      });
    }

    return this.prisma.cmsPage.create({
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
  }

  async updateSeo(id: string, data: { page_key?: string; meta_title?: string; meta_description?: string; meta_keywords?: string; robots?: string }) {
    const page = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!page) {
      throw new NotFoundException('seo page not found');
    }

    return this.prisma.cmsPage.update({
      where: { id },
      data: {
        slug: data.page_key ?? page.slug,
        title: data.meta_title ?? page.title,
        seo: {
          ...((typeof page.seo === 'object' && page.seo) ? (page.seo as Record<string, unknown>) : {}),
          description: data.meta_description ?? '',
          keywords: data.meta_keywords ?? '',
          robots: data.robots ?? '',
        },
      },
    });
  }
}

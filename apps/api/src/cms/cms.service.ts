import {
  publicPage,
  validateSections,
  visibleContentWhere,
} from './content-policy.js';
import {
  readLocalePolicy,
  hasPublishedPageTranslation,
  LANGUAGE_CODE,
} from '../platform/locale-policy.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
        where: {
          ...visibleContentWhere(),
          OR: [{ kind: 'ARTICLE' }, { slug: { contains: 'article' } }],
        },
      }),
      this.prisma.cmsPage.count({
        where: {
          ...visibleContentWhere(),
          OR: [{ kind: 'FAQ' }, { slug: { contains: 'faq' } }],
        },
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

  productReferences(search?: string, ids?: string) {
    return this.prisma.product.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { slug: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(ids ? { id: { in: ids.split(',') } } : {}),
      },
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { name: 'asc' },
      take: 24,
    });
  }

  async listPublishedPages(
    slug?: string,
    locale = 'en',
    market = 'ALL',
    kind?: string,
    productId?: string,
  ) {
    const policy = await readLocalePolicy(this.prisma);
    if (!policy.languages.includes(locale)) return [];
    const rows = await this.prisma.cmsPage.findMany({
      where: {
        ...visibleContentWhere(market),
        ...(slug ? { slug } : {}),
        ...(kind ? { kind } : {}),
        ...(productId ? { productIds: { has: productId } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows
      .filter(
        (page) =>
          hasPublishedPageTranslation(page, locale) ||
          (policy.fallback === 'DEFAULT' &&
            hasPublishedPageTranslation(page, 'en')),
      )
      .map((page) => {
        const result = publicPage(page, locale);
        return {
          ...result,
          indexableLanguages: result.indexableLanguages.filter((language) =>
            policy.languages.includes(language),
          ),
        };
      });
  }

  async getPublishedPage(id: string, locale = 'en', market = 'ALL') {
    const policy = await readLocalePolicy(this.prisma);
    const page = await this.prisma.cmsPage.findFirst({
      where: { ...visibleContentWhere(market), OR: [{ id }, { slug: id }] },
    });
    if (
      !page ||
      !policy.languages.includes(locale) ||
      (!hasPublishedPageTranslation(page, locale) &&
        (policy.fallback === 'HIDE' ||
          !hasPublishedPageTranslation(page, 'en')))
    )
      throw new NotFoundException('Content not found');
    const result = publicPage(page, locale);
    return {
      ...result,
      indexableLanguages: result.indexableLanguages.filter((language) =>
        policy.languages.includes(language),
      ),
    };
  }

  private metadata(input: CreateCmsPageDto | UpdateCmsPageDto) {
    if (input.sections) validateSections(input.sections);
    if (input.status === 'SCHEDULED' && !input.publishAt)
      throw new BadRequestException(
        'Scheduled content requires a publish date',
      );
    if (
      input.publishAt &&
      input.unpublishAt &&
      new Date(input.publishAt) >= new Date(input.unpublishAt)
    )
      throw new BadRequestException('Unpublish date must follow publish date');
    if (input.translations)
      for (const [language, value] of Object.entries(input.translations)) {
        if (!LANGUAGE_CODE.test(language))
          throw new BadRequestException('Invalid translation language code');
        const item = value as Record<string, unknown>;
        if (
          !item ||
          !['NOT_STARTED', 'IN_PROGRESS', 'READY', 'PUBLISHED'].includes(
            String(item.status),
          )
        )
          throw new BadRequestException('Invalid translation status');
        if (Array.isArray(item.sections)) validateSections(item.sections);
        if (
          item.status === 'PUBLISHED' &&
          (typeof item.title !== 'string' ||
            !item.title.trim() ||
            !Array.isArray(item.sections))
        )
          throw new BadRequestException(
            'Published translations require a complete title and body',
          );
      }
    const {
      kind,
      locale,
      market,
      author,
      category,
      productIds,
      sortOrder,
      translations,
      publishAt,
      unpublishAt,
    } = input;
    return {
      kind,
      locale,
      market,
      author,
      category,
      productIds,
      sortOrder,
      ...(translations
        ? { translations: translations as Prisma.InputJsonValue }
        : {}),
      ...(publishAt !== undefined
        ? { publishAt: publishAt ? new Date(publishAt) : null }
        : {}),
      ...(unpublishAt !== undefined
        ? { unpublishAt: unpublishAt ? new Date(unpublishAt) : null }
        : {}),
    };
  }

  async versions(id: string) {
    return this.prisma.cmsRevision.findMany({
      where: { pageId: id },
      orderBy: { revision: 'desc' },
      take: 50,
    });
  }
  async preview(id: string) {
    return this.prisma.cmsPage.findUniqueOrThrow({ where: { id } });
  }
  async restore(id: string, revision: number, actor: JwtPayload, ip?: string) {
    const version = await this.prisma.cmsRevision.findUnique({
      where: { pageId_revision: { pageId: id, revision } },
    });
    if (!version) throw new NotFoundException('Content version not found');
    const snapshot = version.snapshot as Record<string, unknown>;
    return this.updatePage(
      id,
      {
        slug: String(snapshot.slug),
        kind: snapshot.kind as UpdateCmsPageDto['kind'],
        locale: snapshot.locale as UpdateCmsPageDto['locale'],
        market: String(snapshot.market ?? 'ALL'),
        author: String(snapshot.author ?? ''),
        category: String(snapshot.category ?? ''),
        productIds: Array.isArray(snapshot.productIds)
          ? (snapshot.productIds as string[])
          : [],
        sortOrder:
          typeof snapshot.sortOrder === 'number' ? snapshot.sortOrder : 0,
        publishAt:
          typeof snapshot.publishAt === 'string' ? snapshot.publishAt : null,
        unpublishAt:
          typeof snapshot.unpublishAt === 'string'
            ? snapshot.unpublishAt
            : null,
        title: String(snapshot.title),
        sections: snapshot.sections as unknown[],
        seo: snapshot.seo as Record<string, unknown>,
        translations: snapshot.translations as Record<string, unknown>,
        status: 'DRAFT',
      },
      actor,
      ip,
    );
  }

  async createPage(input: CreateCmsPageDto, actor: JwtPayload, ip?: string) {
    const page = await this.prisma.cmsPage.create({
      data: {
        ...this.metadata(input),
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

    const page = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cmsPage.updateMany({
        where: { id, revision: input.expectedRevision ?? exists.revision },
        data: {
          ...this.metadata({
            ...input,
            status: input.status ?? exists.status,
            publishAt:
              input.publishAt === undefined
                ? exists.publishAt?.toISOString()
                : input.publishAt,
            unpublishAt:
              input.unpublishAt === undefined
                ? exists.unpublishAt?.toISOString()
                : input.unpublishAt,
          }),
          revision: { increment: 1 },
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
      if (updated.count !== 1)
        throw new ConflictException('Content changed; reload before saving');
      await tx.cmsRevision.create({
        data: {
          pageId: id,
          revision: exists.revision,
          snapshot: JSON.parse(JSON.stringify(exists)),
          actorId: actor.sub,
        },
      });
      if (input.slug && input.slug !== exists.slug) {
        // Restoring a former slug removes its outgoing redirect before reversing the rename.
        await tx.siteRedirect.deleteMany({
          where: { source: `/content/${input.slug}` },
        });
        await tx.siteRedirect.updateMany({
          where: { destination: `/content/${exists.slug}` },
          data: { destination: `/content/${input.slug}` },
        });
        await tx.siteRedirect.upsert({
          where: { source: `/content/${exists.slug}` },
          update: { destination: `/content/${input.slug}` },
          create: {
            source: `/content/${exists.slug}`,
            destination: `/content/${input.slug}`,
          },
        });
      }
      return tx.cmsPage.findUniqueOrThrow({ where: { id } });
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
    await this.updatePage(
      id,
      { status: 'ARCHIVED', expectedRevision: exists.revision },
      actor,
      ip,
    );
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
      where: {
        ...visibleContentWhere(),
        OR: [{ kind: 'ARTICLE' }, { slug: { contains: 'article' } }],
      },
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
      where: {
        ...visibleContentWhere(),
        OR: [{ kind: 'FAQ' }, { slug: { contains: 'faq' } }],
      },
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
      where: {
        ...visibleContentWhere(),
        OR: [{ kind: 'BANNER' }, { slug: { contains: 'announcement' } }],
      },
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
      where: visibleContentWhere(),
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

    const updated = await this.updatePage(
      id,
      {
        expectedRevision: page.revision,
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
      actor,
      ip,
    );
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

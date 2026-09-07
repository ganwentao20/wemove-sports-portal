import { searchQuery } from './search-query.js';
import { operationMetrics } from './reports.js';
import { validateSetting } from './settings-policy.js';
import { localRedirectPath } from './redirect-policy.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type {
  EventDto,
  NewsletterDto,
  RedirectDto,
  SearchDto,
} from './platform.dto.js';

const DEFAULT_NAV = [
  { label: 'Products', zh: '产品', href: '/products' },
  { label: 'Play & Learn', zh: '玩乐与学习', href: '/play-learn' },
  { label: 'Dealers', zh: '经销商', href: '/dealers' },
  { label: 'Support', zh: '支持', href: '/support' },
  { label: 'About', zh: '关于品牌', href: '/about' },
];
export const DEFAULT_SETTINGS = {
  brand: {
    name: 'WEMOVE SPORTS',
    favicon: '',
    primaryColor: '#b7251e',
    logo: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    socials: [],
  },
  navigation: { items: DEFAULT_NAV },
  search: {
    synonyms: {
      'bowling game': ['bowling set', 'bowling'],
      平衡: ['balance'],
      保龄球: ['bowling'],
    },
  },
  locale: {
    languages: ['en', 'zh'],
    defaultLanguage: 'en',
    fallback: 'DEFAULT',
  },
  notifications: { dealer: [], support: [], orders: [] },
  tracking: { enabled: true, retentionDays: 90 },
};
type SearchItem = {
  locale: string;
  id: string;
  type: string;
  title: string;
  summary: string;
  url: string;
  score: number;
};

export function csv(rows: Record<string, unknown>[]) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    keys.map(cell).join(','),
    ...rows.map((row) => keys.map((key) => cell(row[key])).join(',')),
  ].join('\r\n');
}
export function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return row[b.length];
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}
  async settings() {
    const rows = await this.prisma.siteSetting.findMany();
    return {
      ...DEFAULT_SETTINGS,
      ...Object.fromEntries(rows.map((row) => [row.key, row.value])),
    } as Record<string, any>;
  }
  async publicSettings() {
    const s = await this.settings();
    return {
      brand: s.brand,
      navigation: s.navigation,
      locale: s.locale,
      tracking: { enabled: s.tracking?.enabled === true },
    };
  }
  async saveSetting(
    key: string,
    value: Record<string, unknown>,
    actor: JwtPayload,
  ) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key))
      throw new BadRequestException('Unknown settings group');
    if (JSON.stringify(value).length > 50_000)
      throw new BadRequestException('Settings too large');
    validateSetting(key, value);
    if (key === 'navigation') {
      if (
        !Array.isArray(value.items) ||
        value.items.length > 30 ||
        value.items.some(
          (item) =>
            !item ||
            typeof item.label !== 'string' ||
            !/^\/(?!\/)/.test(String(item.href)),
        )
      )
        throw new BadRequestException(
          'Navigation requires labels and local links',
        );
    }
    const result = await this.prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'settings.update',
      entityType: 'SiteSetting',
      entityId: key,
      after: value as Prisma.InputJsonValue,
    });
    return result;
  }
  async search(query: SearchDto) {
    const normalized = query.q.trim().toLowerCase(),
      config = await this.settings();
    if (!config.locale?.languages?.includes(query.locale))
      throw new BadRequestException('This language is disabled');
    const synonyms = config.search?.synonyms ?? {};
    const words = new Set(
      [
        normalized,
        ...normalized.split(/\s+/).map((s) => s.replace(/(ing|es|s)$/, '')),
      ].filter(Boolean),
    );
    for (const [term, alternatives] of Object.entries(synonyms))
      if (
        term.includes(normalized) ||
        (Array.isArray(alternatives) && alternatives.includes(normalized))
      ) {
        words.add(term);
        if (Array.isArray(alternatives))
          alternatives.forEach((a) => words.add(String(a)));
      }
    if (query.locale === 'zh')
      for (const part of new Intl.Segmenter('zh', {
        granularity: 'word',
      }).segment(normalized))
        if (part.isWordLike) words.add(part.segment);
    const [result] = await this.prisma.$queryRaw<
      Array<{ total: number; items: Array<Omit<SearchItem, 'score'>> }>
    >(
      searchQuery(
        [...words].slice(0, 30),
        query.locale,
        query.market,
        query.type,
        query.page,
        config.locale?.fallback === 'HIDE',
      ),
    );
    const [[recommendations], suggestionRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ items: SearchItem[] }>>(
        searchQuery(
          [''],
          query.locale,
          query.market,
          'PRODUCT',
          1,
          config.locale?.fallback === 'HIDE',
        ),
      ),
      result.total === 0 && normalized
        ? this.prisma.$queryRaw<Array<{ items: SearchItem[] }>>(
            searchQuery(
              [normalized],
              query.locale,
              query.market,
              query.type,
              1,
              config.locale?.fallback === 'HIDE',
              true,
            ),
          )
        : Promise.resolve([]),
    ]);
    const items = result.items.map((item) => {
      let summary = item.summary;
      try {
        const parts = JSON.parse(summary);
        if (Array.isArray(parts))
          summary = parts.filter((v) => typeof v === 'string').join(' ');
      } catch {}
      return { ...item, summary };
    });
    const suggested = (suggestionRows[0]?.items ?? [])
      .filter((row) => Number(row.score) >= 1.5)
      .slice(0, 3);
    return {
      locale: [
        ...items,
        ...(result.total === 0 ? recommendations.items.slice(0, 4) : []),
        ...suggested,
      ].some((item) => item.locale !== query.locale)
        ? 'en'
        : query.locale,
      items,
      total: result.total,
      page: query.page,
      suggestions: items.length
        ? items.slice(0, 6).map((p) => p.title)
        : suggested.map((row) => row.title),
      recommendations: recommendations.items
        .slice(0, 4)
        .map((p) => ({ title: p.title, url: p.url })),
    };
  }

  async event(input: EventDto) {
    if (!input.consent) return { recorded: false };
    const config = await this.settings();
    if (config.tracking?.enabled !== true) return { recorded: false };
    if (
      input.name === 'web_vital' &&
      (!['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].includes(
        String(input.properties?.metric_name),
      ) ||
        typeof input.properties?.metric_id !== 'string' ||
        typeof input.properties?.metric_value !== 'number' ||
        !Number.isFinite(input.properties.metric_value) ||
        input.properties.metric_value < 0)
    )
      throw new BadRequestException('Invalid performance metric');
    const allowed = [
      'market',
      'language',
      'device',
      'module_id',
      'position',
      'target',
      'product_id',
      'variant_id',
      'sku',
      'role',
      'category',
      'sort',
      'query',
      'results_count',
      'qty',
      'quantity',
      'asset_id',
      'visibility',
      'form_type',
      'source',
      'error_code',
      'session_id',
      'availability',
      'filter_name',
      'value',
      'price_type',
      'cart_value',
      'order_id',
      'revenue',
      'currency',
      'channel',
      'application_id',
      'country',
      'company_id',
      'item_count',
      'guest',
      'metric_name',
      'metric_value',
      'metric_id',
      'rating',
    ];
    const properties: Record<string, unknown> = Object.fromEntries(
      Object.entries(input.properties ?? {})
        .filter(
          ([key, value]) =>
            allowed.includes(key) &&
            (['string', 'boolean'].includes(typeof value) ||
              (typeof value === 'number' && Number.isFinite(value))),
        )
        .map(([key, value]) => [
          key,
          typeof value === 'string' ? value.slice(0, 200) : value,
        ]),
    );
    if (Array.isArray(input.properties?.items))
      properties.items = input.properties.items
        .slice(0, 100)
        .filter(
          (row: unknown) =>
            row && typeof row === 'object' && !Array.isArray(row),
        )
        .map((row: Record<string, unknown>) => ({
          ...(typeof row.sku === 'string'
            ? { sku: row.sku.slice(0, 100) }
            : {}),
          ...(typeof row.product_id === 'string'
            ? { product_id: row.product_id.slice(0, 100) }
            : {}),
          ...(Number.isInteger(row.qty) && Number(row.qty) > 0
            ? { qty: Math.min(Number(row.qty), 100000) }
            : {}),
        }));
    if (typeof properties.target === 'string')
      properties.target = properties.target.split(/[?#]/)[0];
    if (
      typeof properties.session_id === 'string' &&
      !/^[\da-f-]{36}$/.test(properties.session_id)
    )
      delete properties.session_id;
    await this.prisma.analyticsEvent.create({
      data: {
        name: input.name,
        path: input.path.split(/[?#]/)[0],
        properties: properties as Prisma.InputJsonValue,
      },
    });
    return { recorded: true };
  }
  async reports(actor: JwtPayload) {
    const since = new Date(Date.now() - 30 * 86400_000);
    const [
      events,
      searches,
      leads,
      applications,
      companies,
      pages,
      orders,
      po,
      mail,
    ] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['name'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.analyticsEvent.findMany({
        where: { name: 'search', createdAt: { gte: since } },
        select: { properties: true },
        take: 5000,
      }),
      this.prisma.contactMessage.groupBy({
        by: ['status', 'source'],
        _count: true,
      }),
      this.prisma.dealerApplication.groupBy({ by: ['status'], _count: true }),
      this.prisma.dealerCompany.count(),
      this.prisma.cmsPage.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.groupBy({
        by: ['status', 'currency', 'market'],
        _count: true,
        _sum: { totalCents: true },
      }),
      this.prisma.purchaseOrder.groupBy({
        by: ['status', 'currency'],
        _count: true,
        _sum: { totalCents: true },
      }),
      this.prisma.notificationOutbox.groupBy({ by: ['status'], _count: true }),
    ]);
    const financial =
      (actor.roles ?? []).includes('SUPER_ADMIN') ||
      ((actor as any).permissions ?? []).includes('reports:financial:read');
    return {
      metrics: await operationMetrics(this.prisma, financial),
      periodDays: 30,
      events,
      searches: searches.map((e) => e.properties),
      leads,
      applications,
      companies,
      pages,
      orders: orders.map(({ _sum, ...row }) => ({
        ...row,
        ...(financial ? { totalCents: _sum.totalCents } : {}),
      })),
      purchaseOrders: po.map(({ _sum, ...row }) => ({
        ...row,
        ...(financial ? { totalCents: _sum.totalCents } : {}),
      })),
      mail,
      financial,
    };
  }
  redirects() {
    return this.prisma.siteRedirect.findMany({ orderBy: { source: 'asc' } });
  }
  async redirect(source: string) {
    return this.prisma.siteRedirect.findUnique({ where: { source } });
  }
  async saveRedirect(input: RedirectDto, actor: JwtPayload) {
    return (await this.importRedirects([input], actor)).items[0];
  }
  async importRedirects(inputs: RedirectDto[], actor: JwtPayload) {
    if (!inputs.length || inputs.length > 500)
      throw new BadRequestException('Import between 1 and 500 redirects');
    const sources = new Set<string>();
    for (const input of inputs) {
      const source = localRedirectPath(input.source);
      localRedirectPath(input.destination);
      if (sources.has(source))
        throw new BadRequestException('Duplicate source: ' + source);
      sources.add(source);
      if (
        input.source === input.destination ||
        /^\/(?:[a-z]{2,3}(?:-[A-Z]{2})?\/)?(api|admin|customer|dealer)(\/|$)/.test(
          source,
        )
      )
        throw new BadRequestException(
          'Cannot redirect protected paths or to self',
        );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('site-redirects',0))`;
      const graph = new Map(
        (await tx.siteRedirect.findMany()).map((row) => [
          row.source,
          row.destination,
        ]),
      );
      inputs.forEach((row) => graph.set(row.source, row.destination));
      for (const source of graph.keys()) {
        let next = source;
        const seen = new Set<string>();
        for (let i = 0; graph.has(next); i++) {
          if (seen.has(next))
            throw new BadRequestException('Redirect cycle at ' + next);
          if (i >= 20) throw new BadRequestException('Redirect chain too long');
          seen.add(next);
          next = graph.get(next)!.split(/[?#]/)[0];
        }
      }
      const items = [];
      for (const input of inputs)
        items.push(
          await tx.siteRedirect.upsert({
            where: { source: input.source },
            create: input,
            update: { destination: input.destination, status: input.status },
          }),
        );
      await tx.auditLog.create({
        data: {
          actorKind: 'STAFF',
          actorStaffId: actor.sub,
          action: 'seo.redirect.import',
          entityType: 'SiteRedirect',
          entityId: items[0].id,
          after: inputs as unknown as Prisma.InputJsonValue,
        },
      });
      return { count: items.length, items };
    });
  }
  async seoAudit() {
    const pages = await this.prisma.cmsPage.findMany();
    const counts = new Map<string, number>();
    pages.forEach((p) => counts.set(p.title, (counts.get(p.title) ?? 0) + 1));
    return {
      pages: pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        status: p.status,
        missingDescription: !(p.seo as any)?.description,
        duplicateTitle: (counts.get(p.title) ?? 0) > 1,
      })),
      missingAlt: await this.prisma.mediaAsset.count({
        where: {
          visibility: 'PUBLIC',
          mimeType: { startsWith: 'image/' },
          alt: '',
        },
      }),
      notFound: await this.prisma.analyticsEvent.findMany({
        where: { name: 'page_404' },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
  async subscribe(input: NewsletterDto) {
    if (!input.consent)
      throw new BadRequestException('Subscription requires privacy consent');
    const email = input.email.trim().toLowerCase(),
      token = randomBytes(32).toString('hex'),
      hash = createHash('sha256').update(token).digest('hex');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`newsletter:${email}`},0))`;
      const current = await tx.newsletterSubscription.findUnique({
        where: { email },
      });
      // Repeated public form submissions cannot revoke a confirmed subscription
      // or invalidate a recently delivered confirmation link.
      if (
        current?.status === 'ACTIVE' ||
        (current?.status === 'PENDING' && current.expiresAt > new Date())
      )
        return false;
      await tx.newsletterSubscription.upsert({
        where: { email },
        create: {
          email,
          locale: input.locale,
          tokenHash: hash,
          consentVersion: input.consentVersion,
          expiresAt: new Date(Date.now() + 86400_000),
        },
        update: {
          locale: input.locale,
          tokenHash: hash,
          consentVersion: input.consentVersion,
          expiresAt: new Date(Date.now() + 86400_000),
          status: 'PENDING',
        },
      });
      const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
      await this.notifications.enqueue(
        {
          kind: 'newsletter.confirm',
          to: email,
          locale: input.locale,
          internalGroup: false,
          subject:
            input.locale === 'zh'
              ? '确认 WEMOVE 邮件订阅'
              : 'Confirm your WEMOVE subscription',
          text: `${base}/newsletter?token=${token}`,
          dedupeKey: `newsletter:${hash}`,
        },
        tx,
      );
      return true;
    });
    return {
      message:
        'If confirmation is needed, check your email. An existing subscription remains active.',
    };
  }
  async subscriptionToken(token: string, unsubscribe = false) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const initial = await this.prisma.newsletterSubscription.findUnique({
      where: { tokenHash },
    });
    if (!initial)
      throw new NotFoundException('Subscription link invalid or expired');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`newsletter:${initial.email}`},0))`;
      const row = await tx.newsletterSubscription.findUnique({
        where: { tokenHash },
      });
      if (
        !row ||
        (!unsubscribe &&
          (row.expiresAt < new Date() || row.status === 'UNSUBSCRIBED'))
      )
        throw new NotFoundException('Subscription link invalid or expired');
      const status = unsubscribe ? 'UNSUBSCRIBED' : 'ACTIVE';
      if (row.status !== status)
        await tx.newsletterSubscription.update({
          where: { email: row.email },
          data: { status },
        });
      await tx.user.updateMany({
        where: { email: row.email, status: 'ACTIVE' },
        data: { marketingEmail: !unsubscribe },
      });
      if (unsubscribe && row.status !== status)
        await this.notifications.enqueue(
          {
            kind: 'newsletter.unsubscribed',
            to: row.email,
            locale: row.locale,
            internalGroup: false,
            subject: 'Your WEMOVE subscription is cancelled',
            text: 'You will no longer receive marketing emails. Account, order and support messages remain available.',
            dedupeKey: 'newsletter-unsubscribe:' + row.tokenHash,
          },
          tx,
        );
    });
    return { status: unsubscribe ? 'UNSUBSCRIBED' : 'ACTIVE' };
  }
}

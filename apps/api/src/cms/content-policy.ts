import { BadRequestException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';

export function safeContentUrl(value: unknown, media = false): string {
  if (typeof value !== 'string' || value.length > 2048)
    throw new BadRequestException('Invalid content URL');
  if (
    /^\/(?!\/)/.test(value) ||
    /^https:\/\//i.test(value) ||
    (!media && /^mailto:[^\s]+@[^\s]+$/.test(value))
  )
    return value;
  throw new BadRequestException(
    'Content links must be local paths or HTTPS URLs',
  );
}

/** The renderer uses text nodes, never raw HTML; unsupported blocks cannot be published. */
export function validateSections(sections: unknown[]) {
  if (sections.length > 100)
    throw new BadRequestException('At most 100 content blocks');
  for (const section of sections) {
    if (!section || typeof section !== 'object' || Array.isArray(section))
      throw new BadRequestException('Invalid content block');
    const block = section as Record<string, unknown>;
    if (
      typeof block.type !== 'string' ||
      ![
        'hero',
        'text',
        'paragraph',
        'heading',
        'list',
        'image',
        'video',
        'quote',
        'cta',
        'products',
        'articles',
        'faq',
        'download',
        'newsletter',
        'categories',
        'values',
        'navigation',
      ].includes(block.type)
    )
      throw new BadRequestException('Unsupported content block');
    const props =
      block.props && typeof block.props === 'object'
        ? (block.props as Record<string, unknown>)
        : block;
    for (const key of ['enabled', 'dismissible'])
      if (props[key] !== undefined && typeof props[key] !== 'boolean')
        throw new BadRequestException(`${key} must be a boolean`);
    for (const key of ['publishAt', 'unpublishAt'])
      if (
        props[key] !== undefined &&
        props[key] !== null &&
        (typeof props[key] !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
            String(props[key]),
          ) ||
          !isISO8601(String(props[key]), {
            strict: true,
            strictSeparator: true,
          }))
      )
        throw new BadRequestException(
          'Module publication dates must use valid ISO timestamps with a timezone',
        );
    if (
      props.publishAt &&
      props.unpublishAt &&
      new Date(String(props.publishAt)) >= new Date(String(props.unpublishAt))
    )
      throw new BadRequestException('Module end must follow its start');
    if (
      props.align !== undefined &&
      !['left', 'center', 'right'].includes(String(props.align))
    )
      throw new BadRequestException(
        'Module alignment must be left, center or right',
      );
    if (props.items !== undefined) {
      if (!Array.isArray(props.items) || props.items.length > 100)
        throw new BadRequestException(
          'List items must be an array of at most 100 entries',
        );
      for (const item of props.items) {
        if (typeof item === 'string') continue;
        if (!item || typeof item !== 'object' || Array.isArray(item))
          throw new BadRequestException(
            'List entries need text or labeled objects',
          );
        if (item.href) safeContentUrl(item.href);
      }
    }
    if (
      props.productIds !== undefined &&
      (!Array.isArray(props.productIds) ||
        props.productIds.length > 24 ||
        props.productIds.some(
          (id) => typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id),
        ))
    )
      throw new BadRequestException('Choose at most 24 valid product IDs');
    if (
      props.articleIds !== undefined &&
      (!Array.isArray(props.articleIds) ||
        props.articleIds.length > 24 ||
        props.articleIds.some(
          (id) => typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id),
        ))
    )
      throw new BadRequestException('Choose at most 24 valid article IDs');
    for (const key of [
      'href',
      'secondaryHref',
      'url',
      'src',
      'image',
      'mobileImage',
      'poster',
    ])
      if (props[key])
        safeContentUrl(
          props[key],
          key !== 'href' && key !== 'secondaryHref' && key !== 'url',
        );
    if (JSON.stringify(block).length > 30_000)
      throw new BadRequestException('Content block too large');
  }
}
export function visibleSections(
  sections: unknown,
  now = new Date(),
): unknown[] {
  if (!Array.isArray(sections)) return [];
  return sections.filter((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section))
      return false;
    const row = section as Record<string, unknown>,
      props = (row.props ?? row) as Record<string, unknown>;
    return (
      props.enabled !== false &&
      (!props.publishAt || new Date(String(props.publishAt)) <= now) &&
      (!props.unpublishAt || new Date(String(props.unpublishAt)) > now)
    );
  });
}

export function visibleContentWhere(market = 'ALL') {
  const now = new Date();
  return {
    AND: [
      {
        OR: [
          { status: 'PUBLISHED' as const },
          { status: 'SCHEDULED' as const, publishAt: { lte: now } },
        ],
      },
      { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      { OR: [{ unpublishAt: null }, { unpublishAt: { gt: now } }] },
      ...(market === 'ALL' ? [] : [{ OR: [{ market: 'ALL' }, { market }] }]),
    ],
  };
}

export function localizePage<
  T extends { locale: string; translations: unknown },
>(page: T, locale = 'en'): T {
  if (locale === page.locale) return page;
  const translations = page.translations as Record<
    string,
    Record<string, unknown>
  > | null;
  const requested = translations?.[locale];
  const complete = (value: Record<string, unknown> | undefined) =>
    value?.status === 'PUBLISHED' &&
    typeof value.title === 'string' &&
    !!value.title.trim() &&
    Array.isArray(value.sections);
  const effectiveLocale = complete(requested) ? locale : 'en';
  const translated = translations?.[effectiveLocale];
  // Fallback is an entire default-language page, never a partly translated body.
  if (
    !translated ||
    translated.status !== 'PUBLISHED' ||
    typeof translated.title !== 'string' ||
    !translated.title.trim() ||
    !Array.isArray(translated.sections)
  )
    return page;
  return {
    ...page,
    locale: effectiveLocale,
    title: translated.title,
    sections: translated.sections,
    seo: translated.seo ?? {},
  };
}

export function indexablePageLanguages(page: {
  locale: string;
  translations: unknown;
  seo?: unknown;
}): string[] {
  const versions = (page.translations ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return [
    page.locale,
    ...Object.keys(versions).filter((language) => language !== page.locale),
  ].filter((language) => {
    const translation = versions[language];
    if (
      language !== page.locale &&
      (translation?.status !== 'PUBLISHED' ||
        typeof translation.title !== 'string' ||
        !translation.title.trim() ||
        !Array.isArray(translation.sections))
    )
      return false;
    const seo = (
      language === page.locale ? page.seo : (translation?.seo ?? {})
    ) as Record<string, unknown> | null;
    return !seo?.noindex && !String(seo?.robots ?? '').includes('noindex');
  });
}

export function publicPage<
  T extends {
    locale: string;
    translations: unknown;
    sections?: unknown;
    seo?: unknown;
  },
>(page: T, locale = 'en') {
  const localized = localizePage(page, locale);
  const published = Object.fromEntries(
    Object.entries(
      (page.translations ?? {}) as Record<string, Record<string, unknown>>,
    )
      .filter(
        ([, value]) =>
          value?.status === 'PUBLISHED' &&
          typeof value.title === 'string' &&
          value.title.trim() &&
          Array.isArray(value.sections),
      )
      .map(([language]) => [language, { status: 'PUBLISHED' }]),
  );
  return {
    ...localized,
    sections: visibleSections(localized.sections),
    translations: published,
    indexableLanguages: indexablePageLanguages(page),
  };
}

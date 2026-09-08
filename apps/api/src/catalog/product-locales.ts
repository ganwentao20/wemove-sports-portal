type ProductTranslationSource = {
  specifications: unknown;
  description?: string | null;
  ageGuidance?: string | null;
  playGuide?: string | null;
  productFaq?: unknown;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

/** Localize live product labels without exposing translation drafts or internal JSON. */
export function localizedProductSummary(
  row: ProductTranslationSource & { name: string; summary?: string | null },
  locale: string,
) {
  const translation = publishedProductLanguages(row).includes(locale) && locale !== 'en'
    ? object(object(object(row.specifications).translations)[locale]) : {};
  return {
    name: text(translation.name) ? String(translation.name) : row.name,
    summary: text(translation.summary) ? String(translation.summary) : row.summary,
  };
}

export function productSeoForLanguage(
  row: { specifications: unknown; seo?: unknown },
  locale: string,
): Record<string, unknown> {
  const base = object(row.seo);
  if (locale === 'en') return base;
  const value = object(
    object(object(row.specifications).translations)[locale],
  ).seo;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? object(value)
    : {
        noindex:
          !!base.noindex || String(base.robots ?? '').includes('noindex'),
      };
}
export function indexableProductLanguages(
  row: ProductTranslationSource & { seo?: unknown },
): string[] {
  return publishedProductLanguages(row).filter((locale) => {
    const seo = productSeoForLanguage(row, locale);
    return !seo.noindex && !String(seo.robots ?? '').includes('noindex');
  });
}

export const PRODUCT_LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

/** Optional display labels never replace the stable codes used in filtering. */
export function productDisplayLabels(
  row: ProductTranslationSource & {
    tags: string[];
    skills: string[];
    scenes: string[];
  },
  locale: string,
) {
  const translation =
    publishedProductLanguages(row).includes(locale) && locale !== 'en'
      ? object(object(object(row.specifications).translations)[locale])
      : {};
  const labels = (codes: string[], key: string): Record<string, string> => {
    const values = object(translation[key]);
    return Object.fromEntries(
      codes.map((code) => [
        code,
        text(values[code]) ? String(values[code]) : code,
      ]),
    );
  };
  return {
    tagLabels: labels(row.tags, 'tagLabels'),
    skillLabels: labels(row.skills, 'skillLabels'),
    sceneLabels: labels(row.scenes, 'sceneLabels'),
  };
}

export function localizedVariant<
  T extends { sku: string; name: string | null; attrs: unknown },
>(variant: T, row: ProductTranslationSource, locale: string): T {
  if (locale === 'en' || !publishedProductLanguages(row).includes(locale))
    return variant;
  const translation = object(
    object(object(object(row.specifications).translations)[locale]).variants,
  );
  const translated = object(translation[variant.sku]);
  const translatedAttrs = object(translated.attrs);
  return {
    ...variant,
    name: text(translated.name) ? String(translated.name) : variant.name,
    attrs: Object.fromEntries(
      Object.entries(object(variant.attrs)).map(([key, value]) => {
        const replacement = object(translatedAttrs[key]);
        return ['string', 'number', 'boolean'].includes(typeof value) &&
          text(replacement.label) &&
          ['string', 'number', 'boolean'].includes(typeof replacement.value) &&
          (typeof replacement.value !== 'string' || text(replacement.value))
          ? [String(replacement.label), replacement.value]
          : [key, value];
      }),
    ) as T['attrs'],
  };
}

/** Category translations share the existing SEO JSON, but drafts remain private. */
export function localizedCategory<
  T extends { name: string; description?: string | null; seo: unknown },
>(category: T, locale: string): T {
  const { translations, ...seo } = object(category.seo);
  const translation = object(object(translations)[locale]);
  if (
    locale === 'en' ||
    translation.status !== 'PUBLISHED' ||
    !text(translation.name)
  )
    return { ...category, seo };
  return {
    ...category,
    name: String(translation.name),
    description: text(translation.description)
      ? String(translation.description)
      : category.description,
    seo: { ...seo, ...object(translation.seo) },
  };
}

/** Keep the productTranslation predicate in platform/search-query.ts in sync. */
export function publishedProductLanguages(
  row: ProductTranslationSource,
): string[] {
  return [
    'en',
    ...Object.entries(object(object(row.specifications).translations))
      .filter(
        ([locale, translation]) =>
          locale !== 'en' &&
          PRODUCT_LOCALE_PATTERN.test(locale) &&
          completeTranslation(row, object(translation)),
      )
      .map(([locale]) => locale),
  ];
}
function completeTranslation(
  row: ProductTranslationSource,
  translation: Record<string, unknown>,
): boolean {
  const source = object(row.specifications);
  if (translation.status !== 'PUBLISHED') return false;
  if (
    !['name', 'summary', 'description', 'ageGuidance', 'playGuide'].every(
      (key) =>
        (key !== 'name' &&
          key !== 'summary' &&
          !row[key as keyof ProductTranslationSource]) ||
        text(translation[key]),
    )
  )
    return false;
  const translatedSpecs = object(translation.specifications);
  for (const [key, value] of Object.entries(source)) {
    if (
      key === 'translations' ||
      key === 'reviews' ||
      !['string', 'number', 'boolean'].includes(typeof value)
    )
      continue;
    const translated = object(translatedSpecs[key]);
    if (
      !text(translated.label) ||
      !['string', 'number', 'boolean'].includes(typeof translated.value) ||
      (typeof translated.value === 'string' && !text(translated.value))
    )
      return false;
  }
  const faq = Array.isArray(row.productFaq) ? row.productFaq : [];
  if (
    faq.length &&
    (!Array.isArray(translation.productFaq) ||
      translation.productFaq.length !== faq.length ||
      !translation.productFaq.every(
        (item) => text(object(item).question) && text(object(item).answer),
      ))
  )
    return false;
  return true;
}

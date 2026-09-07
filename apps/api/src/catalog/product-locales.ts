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

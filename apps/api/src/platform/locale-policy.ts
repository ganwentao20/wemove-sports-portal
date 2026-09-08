import type { PrismaService } from '../prisma/prisma.service.js';
export const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
export const LANGUAGE_PREFIX =
  /^\/(?!api(?=\/|$))([a-z]{2,3}(?:-[A-Z]{2})?)(?=\/|$)/;
export async function readLocalePolicy(
  prisma: Pick<PrismaService, 'siteSetting'>,
): Promise<{
  languages: string[];
  defaultLanguage: 'en';
  fallback: 'DEFAULT' | 'HIDE';
}> {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'locale' } });
  const config = (row?.value ?? {}) as Record<string, unknown>;
  return {
    languages: Array.isArray(config.languages)
      ? [
          ...new Set([
            'en',
            ...config.languages.filter(
              (language): language is string =>
                typeof language === 'string' && LANGUAGE_CODE.test(language),
            ),
          ]),
        ]
      : ['en', 'zh'],
    defaultLanguage: 'en',
    fallback: config.fallback === 'HIDE' ? 'HIDE' : 'DEFAULT',
  };
}
export function hasPublishedPageTranslation(
  page: { locale: string; translations: unknown },
  locale: string,
) {
  if (page.locale === locale) return true;
  const translation = (
    page.translations as Record<string, Record<string, unknown>> | null
  )?.[locale];
  return (
    translation?.status === 'PUBLISHED' &&
    typeof translation.title === 'string' &&
    !!translation.title.trim() &&
    Array.isArray(translation.sections)
  );
}

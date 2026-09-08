import type { Prisma, PrismaClient } from '@prisma/client';
import { demoContentPages } from './seed-content-data.ts';
import { demoContentZh } from './seed-content-zh.ts';

type DemoPage = {
  slug: string;
  title: string;
  kind: string;
  locale?: string;
  status: string;
  sections: unknown;
  translations?: unknown;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? '';
}
function translated(value: unknown): Prisma.InputJsonValue {
  if (typeof value === 'string') return demoContentZh[value] ?? value;
  if (Array.isArray(value)) return value.map(translated);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, translated(item)]),
    );
  return value as Prisma.InputJsonValue;
}
/** Add only absent Chinese for unchanged, published demo originals. Editorial drafts are never published. */
export function demoContentLocalePatch(page: DemoPage): {
  translations?: Prisma.InputJsonObject;
} {
  const original = demoContentPages.find((item) => item.slug === page.slug);
  if (
    !original ||
    page.locale?.toLowerCase().startsWith('zh') ||
    page.status !== 'PUBLISHED' ||
    original.title !== page.title ||
    original.kind !== page.kind ||
    canonical(page.sections) !== canonical(original.sections)
  )
    return {};
  const translations =
    page.translations &&
    typeof page.translations === 'object' &&
    !Array.isArray(page.translations)
      ? (page.translations as Prisma.InputJsonObject)
      : {};
  if (Object.hasOwn(translations, 'zh')) return {};
  return {
    translations: {
      ...translations,
      zh: {
        status: 'PUBLISHED',
        title: demoContentZh[original.title],
        sections: translated(original.sections),
        seo: { description: demoContentZh[original.title] },
      },
    },
  };
}
export async function seedContentLocales(prisma: PrismaClient) {
  if (process.env.DEPLOYMENT_ENV === 'production') return [];
  const rows = await prisma.cmsPage.findMany({
    where: { slug: { in: demoContentPages.map((page) => page.slug) } },
  });
  const results = [];
  for (const row of rows) {
    const patch = demoContentLocalePatch(row);
    let updated = false;
    if (patch.translations) {
      // Do not overwrite an editor's concurrent save or change any publication dates.
      const result = await prisma.cmsPage.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: patch,
      });
      updated = result.count > 0;
    }
    results.push({ slug: row.slug, updated });
  }
  return results;
}

import type { PrismaClient } from '@prisma/client';
import { demoContentPages } from './seed-content-data.ts';
import { seedContentLocales } from './seed-content-locales.ts';
import { demoContentZh } from './seed-content-zh.ts';

function translatedDemo(value: unknown): unknown {
  if (typeof value === 'string') return demoContentZh[value] ?? value;
  if (Array.isArray(value)) return value.map(translatedDemo);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, translatedDemo(item)]),
    );
  return value;
}

export async function seedContent(prisma: PrismaClient) {
  if (process.env.DEPLOYMENT_ENV === 'production') return;
  for (const p of demoContentPages) {
    const existing = await prisma.cmsPage.findUnique({ where: { slug: p.slug } });
    const obsoleteDemoHome =
      p.slug === 'home' &&
      JSON.stringify(existing?.sections ?? {}).includes(
        '/images/wemove-active-play-hero.png',
      );
    const migrateOriginalChinese =
      'locale' in p &&
      p.locale === 'zh' &&
      existing?.locale === 'en' &&
      existing.author === 'WEMOVE SPORTS';
    const migrateKnownSportsDemo =
      ['about', 'article-active-family-play'].includes(p.slug) &&
      JSON.stringify({
        title: existing?.title,
        sections: existing?.sections,
        translations: existing?.translations,
      }).match(
        /active family play|sports games|运动玩乐|运动玩具/i,
      );
    const migrateKnownAuthor = existing?.author === 'WEMOVE SPORTS';
    await prisma.cmsPage.upsert({
      where: { slug: p.slug },
      update:
        obsoleteDemoHome ||
        migrateOriginalChinese ||
        migrateKnownSportsDemo ||
        migrateKnownAuthor
          ? {
              title: p.title,
              sections: p.sections,
              ...('locale' in p ? { locale: p.locale } : {}),
              seo: { description: p.title },
              author: 'WEMOVE',
              ...(migrateKnownSportsDemo
                ? {
                    translations: {
                      zh: {
                        status: 'PUBLISHED',
                        title: demoContentZh[p.title] ?? p.title,
                        sections: translatedDemo(p.sections),
                        seo: {
                          description: demoContentZh[p.title] ?? p.title,
                        },
                      },
                    },
                  }
                : {}),
            }
          : {},
      create: {
        ...p,
        status: 'PUBLISHED',
        seo: { description: p.title },
        author: 'WEMOVE',
      },
    });
  }
  await seedContentLocales(prisma);
}

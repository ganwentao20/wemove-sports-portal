import { describe, expect, it } from 'vitest';
import { demoContentPages } from './seed-content-data.ts';
import { demoContentLocalePatch } from './seed-content-locales.ts';
import { demoContentZh } from './seed-content-zh.ts';

describe('non-destructive demo CMS translations', () => {
  it.each(demoContentPages.filter((source) => source.locale !== 'zh'))(
    'provides complete published Chinese for $slug and remains idempotent',
    (source) => {
      const page = {
        ...source,
        status: 'PUBLISHED',
        translations: { fr: { status: 'IN_PROGRESS' } },
      };
      const original = structuredClone(page);
      const patch = demoContentLocalePatch(page);
      expect(page).toEqual(original);
      expect(patch.translations?.zh).toMatchObject({
        status: 'PUBLISHED',
        title: demoContentZh[page.title],
      });
      expect(patch.translations?.fr).toEqual(page.translations.fr);
      expect(demoContentLocalePatch({ ...page, ...patch })).toEqual({});
      function check(value: unknown) {
        if (
          typeof value === 'string' &&
          /[A-Za-z] /.test(value) &&
          !value.startsWith('/')
        )
          expect(demoContentZh[value]).toBeDefined();
        if (Array.isArray(value)) value.forEach(check);
        else if (value && typeof value === 'object')
          Object.values(value).forEach(check);
      }
      check(page.sections);
    },
  );
  it('does not create a redundant translation for Chinese source pages', () => {
    for (const source of demoContentPages.filter(
      (page) => page.locale === 'zh',
    ))
      expect(
        demoContentLocalePatch({ ...source, status: 'PUBLISHED' }),
      ).toEqual({});
  });
  it('preserves any existing translation including an empty editorial draft', () => {
    for (const zh of [
      { status: 'IN_PROGRESS', title: '编辑草稿' },
      { status: 'PUBLISHED', title: '编辑内容' },
      {},
    ])
      expect(
        demoContentLocalePatch({
          ...demoContentPages[0],
          status: 'PUBLISHED',
          translations: { zh },
        }),
      ).toEqual({});
  });
  it('does not publish translations of modified, draft or unrelated content', () => {
    const base = { ...demoContentPages[1], status: 'PUBLISHED' };
    for (const patch of [
      { title: 'Edited' },
      { sections: [] },
      { kind: 'ARTICLE' },
      { status: 'DRAFT' },
      { slug: 'custom-page' },
    ])
      expect(demoContentLocalePatch({ ...base, ...patch })).toEqual({});
  });
});

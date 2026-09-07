import { validateSetting } from './settings-policy.js';
import { readLocalePolicy } from './locale-policy.js';
import { publicPage } from '../cms/content-policy.js';
import { localRedirectPath } from './redirect-policy.js';
import type { PrismaService } from '../prisma/prisma.service.js';
it('accepts configured language and region codes while preserving English default', async () => {
  const policy = {
    languages: ['en', 'zh', 'fr', 'de', 'pt-BR'],
    defaultLanguage: 'en',
    fallback: 'HIDE',
  };
  expect(() => validateSetting('locale', policy)).not.toThrow();
  for (const languages of [
    ['fr'],
    ['en', 'EN'],
    ['en', 'fr_fr'],
    ['en', 'en'],
    ['en', '/admin'],
  ])
    expect(() => validateSetting('locale', { ...policy, languages })).toThrow();
  expect(() =>
    validateSetting('locale', { ...policy, defaultLanguage: 'fr' }),
  ).toThrow();
  const prisma = {
    siteSetting: { findUnique: async () => ({ value: policy }) },
  } as unknown as Pick<PrismaService, 'siteSetting'>;
  expect((await readLocalePolicy(prisma)).languages).toEqual(policy.languages);
  expect(localRedirectPath('/fr-FR/about')).toBe('/about');
  expect(localRedirectPath('/api/secure')).toBe('/api/secure');
  expect(localRedirectPath('/fr/api/secure')).toBe('/api/secure');
});
it('uses the full English translation when a non-English source lacks the requested language', () => {
  const page = {
    locale: 'fr',
    title: 'Source française',
    sections: [{ type: 'text', props: { text: 'Source' } }],
    translations: {
      en: {
        status: 'PUBLISHED',
        title: 'English title',
        sections: [{ type: 'text', props: { text: 'Entire English body' } }],
      },
      de: { status: 'IN_PROGRESS', title: 'Private title', sections: [] },
    },
  };
  expect(publicPage(page, 'de')).toMatchObject({
    locale: 'en',
    title: 'English title',
    sections: [{ type: 'text', props: { text: 'Entire English body' } }],
  });
  expect(JSON.stringify(publicPage(page, 'de'))).not.toContain('Private title');
});

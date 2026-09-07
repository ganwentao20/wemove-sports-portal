import { describe, expect, it } from 'vitest';
import { validateNavigation } from './navigation-policy.js';
import { publicPage, validateSections } from '../cms/content-policy.js';
describe('Operational navigation and scheduled modules', () => {
  it('accepts two localized market-scoped levels and rejects deeper or external navigation', () => {
    expect(() =>
      validateNavigation([
        {
          label: 'Shop',
          href: '/products',
          markets: ['US'],
          labels: { fr: 'Boutique' },
          children: [{ label: 'Balance', href: '/products?category=balance' }],
        },
      ]),
    ).not.toThrow();
    for (const items of [
      [{ label: 'Bad', href: '//outside.test' }],
      [{ label: 'Bad', href: '/\\outside.test' }],
      [
        {
          label: 'Bad',
          href: '/',
          children: [{ label: 'Bad', href: '/', children: [] }],
        },
      ],
      [{ label: 'Bad', href: '/', markets: ['USA'] }],
    ])
      expect(() => validateNavigation(items)).toThrow();
  });
  it('validates hero video, alignment, article selection and publication windows', () => {
    expect(() =>
      validateSections([
        {
          type: 'hero',
          props: {
            src: '/video.mp4',
            poster: '/poster.jpg',
            align: 'center',
            publishAt: '2026-01-01T00:00:00Z',
            unpublishAt: '2027-01-01T00:00:00Z',
          },
        },
        { type: 'articles', props: { articleIds: ['article-a'] } },
      ]),
    ).not.toThrow();
    for (const props of [
      { align: 'diagonal' },
      { publishAt: 'not-a-date' },
      { publishAt: '2026-02-30T00:00:00Z' },
      { publishAt: '2026-01-01T00:00:00' },
      {
        publishAt: '2027-01-01T00:00:00Z',
        unpublishAt: '2026-01-01T00:00:00Z',
      },
      { enabled: 'no' },
      { dismissible: 'no' },
      { secondaryHref: 'javascript:alert(1)' },
      { articleIds: Array(25).fill('a') },
    ])
      expect(() => validateSections([{ type: 'hero', props }])).toThrow();
  });
  it('removes unpublished modules from public API content as well as their translations', () => {
    const future = new Date(Date.now() + 86400_000).toISOString(),
      past = new Date(Date.now() - 86400_000).toISOString();
    const sections = [
      { type: 'hero', props: { title: 'Visible' } },
      { type: 'text', props: { text: 'DISABLED', enabled: false } },
      { type: 'text', props: { text: 'FUTURE', publishAt: future } },
      { type: 'text', props: { text: 'EXPIRED', unpublishAt: past } },
    ];
    const result = publicPage(
      {
        locale: 'en',
        sections,
        translations: { fr: { status: 'PUBLISHED', title: 'Titre', sections } },
      },
      'fr',
    );
    expect(result.sections).toEqual([sections[0]]);
    expect(JSON.stringify(result)).not.toMatch(/DISABLED|FUTURE|EXPIRED/);
  });
});

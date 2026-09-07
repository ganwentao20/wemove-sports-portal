import {
  publicPage,
  validateSections,
  visibleContentWhere,
} from '../cms/content-policy.js';
import { csv, distance } from './platform.service.js';
import { localRedirectPath } from './redirect-policy.js';
import { validateSetting } from './settings-policy.js';
describe('Content and platform policies', () => {
  it('rejects executable links and unknown render blocks', () => {
    expect(() =>
      validateSections([
        { type: 'cta', props: { href: 'javascript:alert(1)' } },
      ]),
    ).toThrow();
    expect(() => validateSections([{ type: 'script' }])).toThrow();
    expect(() =>
      validateSections([
        { type: 'image', props: { src: '//private.example' } },
      ]),
    ).toThrow();
  });
  it('renders a whole default-language page and hides unpublished translation bodies', () => {
    const p = {
      locale: 'en',
      title: 'English',
      sections: [{ type: 'text', props: { text: 'English body' } }],
      translations: {
        zh: { status: 'IN_PROGRESS', title: 'Private draft', sections: [] },
      },
    };
    expect(publicPage(p, 'zh')).toMatchObject({
      locale: 'en',
      title: 'English',
      translations: {},
    });
    expect(JSON.stringify(publicPage(p, 'zh'))).not.toContain('Private draft');
  });
  it('publishes complete translated title/body and exposes only language metadata', () => {
    const p = {
      locale: 'en',
      title: 'English',
      translations: {
        zh: {
          status: 'PUBLISHED',
          title: '中文',
          sections: [{ type: 'text', props: { text: '正文' } }],
        },
      },
    };
    expect(publicPage(p, 'zh')).toMatchObject({
      locale: 'zh',
      title: '中文',
      translations: { zh: { status: 'PUBLISHED' } },
    });
  });
  it('keeps scheduled windows and market visibility in a shared public policy', () => {
    const where = JSON.stringify(visibleContentWhere('GB'));
    expect(where).toContain('unpublishAt');
    expect(where).toContain('SCHEDULED');
    expect(where).toContain('GB');
  });
  it('neutralizes spreadsheet formulas and escapes multiline quoted CSV cells', () => {
    const value = csv([{ name: '=CMD()', description: 'A "quoted"\nline' }]);
    expect(value).toContain("'=CMD()");
    expect(value).toContain('""quoted""');
  });
  it('bounds typo comparison', () => {
    expect(distance('bowling', 'bowlin')).toBe(1);
    expect(distance('a', 'verylong')).toBe(3);
  });
  it('rejects browser-normalized external redirects and invalid brand settings', () => {
    for (const value of [
      '/\\outside.test',
      '/%5Coutside.test',
      '/%255Coutside.test',
      '//outside.test',
    ])
      expect(() => localRedirectPath(value)).toThrow();
    expect(localRedirectPath('/zh/admin/users')).toBe('/admin/users');
    expect(() =>
      validateSetting('brand', { primaryColor: '#ffffff' }),
    ).toThrow();
    expect(() =>
      validateSetting('brand', { logo: 'javascript:alert(1)' }),
    ).toThrow();
    expect(() =>
      validateSetting('notifications', { support: ['bad-email'] }),
    ).toThrow();
  });
});

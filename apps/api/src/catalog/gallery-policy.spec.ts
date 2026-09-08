import { describe, expect, it } from 'vitest';
import { galleryFor } from './gallery-policy.js';
describe('Editorial media targeting', () => {
  const gallery = [
    { url: '/base.jpg', alt: 'Base' },
    { url: '/us.jpg', alt: 'US', market: 'US' },
    { url: '/zh.jpg', alt: '中文', locale: 'zh' },
    { url: '/zh-us-2.jpg', alt: 'Second', locale: 'zh', market: 'US' },
    { url: '/zh-us-1.jpg', alt: 'First', locale: 'zh', market: 'US' },
  ];
  it('retains drag order within the most specific matching gallery and removes targeting metadata', () => {
    expect(galleryFor(gallery, 'zh', 'US')).toEqual([
      { url: '/zh-us-2.jpg', alt: 'Second' },
      { url: '/zh-us-1.jpg', alt: 'First' },
    ]);
    expect(galleryFor(gallery, 'zh', 'CN')).toEqual([
      { url: '/zh.jpg', alt: '中文' },
    ]);
    expect(galleryFor(gallery, 'en', 'US')).toEqual([
      { url: '/us.jpg', alt: 'US' },
    ]);
  });
  it('uses neutral assets and preserves mixed legacy galleries when no scoped gallery matches', () => {
    expect(
      galleryFor(
        ['/legacy.jpg', { url: '/neutral.jpg', alt: 'Neutral' }, gallery[3]],
        'en',
        'CN',
      ),
    ).toEqual([
      { url: '/legacy.jpg', alt: '' },
      { url: '/neutral.jpg', alt: 'Neutral' },
    ]);
  });
  it('does not leak a media asset targeted only at another language or market', () => {
    expect(galleryFor([gallery[3]], 'en', 'CN')).toEqual([]);
  });
});

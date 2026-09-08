import { describe, expect, it } from 'vitest';
import {
  demoProductLocalePatch,
  type DemoProductContent,
} from './seed-catalog-locales.ts';
import { publishedProductLanguages } from '../src/catalog/product-locales.ts';

const products = [
  [
    'strike-kids-bowling-set-6-pin',
    'Strike! Kids Bowling Set — 6 Pins',
    'Recommended for ages 3+. Adult assembly and supervision required.',
  ],
  [
    'balance-board-wooden-arc',
    'Wooden Balance Board — Arc',
    'Recommended for ages 3+. Use on a level surface with adult supervision.',
  ],
  [
    'ring-toss-outdoor-game-set',
    'Ring Toss Outdoor Game Set',
    'Recommended for ages 4+. Adult supervision required during play.',
  ],
];
function source([slug, name, ageGuidance] = products[0]): DemoProductContent {
  return {
    slug,
    name,
    summary: `Demo ${name}`,
    ageGuidance,
    description: null,
    playGuide: null,
    productFaq: [],
    specifications: {},
    skills: [],
    scenes: [],
  };
}
describe('non-destructive demo product locale seed', () => {
  it.each(products)(
    'publishes complete Chinese for %s and is idempotent',
    (...product) => {
      const row = source(product);
      const original = structuredClone(row);
      const result = {
        ...row,
        ...demoProductLocalePatch(row),
      } as DemoProductContent;
      expect(row).toEqual(original);
      expect(publishedProductLanguages(result)).toEqual(['en', 'zh']);
      expect(result.description).toBeTruthy();
      expect(result.playGuide).toBeTruthy();
      expect(result.productFaq).toHaveLength(2);
      expect(demoProductLocalePatch(result)).toEqual({});
      expect(result.name).toEqual(original.name);
      expect(result.summary).toEqual(original.summary);
    },
  );
  it('preserves editorial drafts, translated copy, reviews and other locales', () => {
    const row = source();
    row.specifications = {
      reviews: [{ rating: 4 }],
      translations: {
        zh: {
          status: 'DRAFT',
          name: '编辑保留的名称',
          specifications: { pins: { label: '编辑瓶数', value: 6 } },
        },
        fr: { name: 'Nom privé' },
      },
    };
    const result = {
      ...row,
      ...demoProductLocalePatch(row),
    } as DemoProductContent;
    expect(result.specifications).toMatchObject({
      reviews: [{ rating: 4 }],
      translations: {
        zh: {
          status: 'DRAFT',
          name: '编辑保留的名称',
          specifications: { pins: { label: '编辑瓶数', value: 6 } },
        },
        fr: { name: 'Nom privé' },
      },
    });
    expect(publishedProductLanguages(result)).toEqual(['en']);
  });
  it('does not publish demo translations as translations of an edited source', () => {
    const row = {
      ...source(),
      description: 'An editor has replaced the source copy.',
      specifications: { material: 'Custom material' },
    };
    const result = {
      ...row,
      ...demoProductLocalePatch(row),
    } as DemoProductContent;
    expect(result.description).toBe(row.description);
    expect(result.specifications).toMatchObject({
      material: 'Custom material',
      translations: { zh: { status: 'DRAFT' } },
    });
    expect(publishedProductLanguages(result)).toEqual(['en']);
  });
  it('does not touch products outside the three demo slugs', () => {
    expect(
      demoProductLocalePatch({ ...source(), slug: 'user-product' }),
    ).toEqual({});
  });
});

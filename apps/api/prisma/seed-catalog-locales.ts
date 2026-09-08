import type { Prisma, PrismaClient } from '@prisma/client';
import { publishedProductLanguages } from '../src/catalog/product-locales.ts';

type JsonObject = Record<string, any>;
export type DemoProductContent = {
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  ageGuidance: string | null;
  playGuide: string | null;
  productFaq: unknown;
  specifications: unknown;
  skills: string[];
  scenes: string[];
};
const object = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
const missing = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

/** Only absent values are filled; edited text, arrays and explicit draft states survive. */
export function fillMissingContent(existing: unknown, defaults: unknown): any {
  if (missing(existing)) return structuredClone(defaults);
  if (
    !Array.isArray(existing) &&
    !Array.isArray(defaults) &&
    existing &&
    defaults &&
    typeof existing === 'object' &&
    typeof defaults === 'object'
  ) {
    const result = { ...object(existing) };
    for (const [key, value] of Object.entries(object(defaults)))
      result[key] = fillMissingContent(result[key], value);
    return result;
  }
  return structuredClone(existing);
}

const DEMO_PRODUCTS: Record<string, { source: JsonObject; zh: JsonObject }> = {
  'strike-kids-bowling-set-6-pin': {
    source: {
      name: 'Strike! Kids Bowling Set — 6 Pins',
      summary: 'Demo Strike! Kids Bowling Set — 6 Pins',
      skills: ['Coordination', 'Aiming'],
      scenes: [],
      description:
        'A six-pin bowling set for taking turns, choosing a starting line and aiming at a shared target. Choose the red or blue set before adding it to your basket.',
      ageGuidance:
        'Recommended for ages 3+. Adult assembly and supervision required.',
      playGuide:
        'Arrange the pins on a level surface and agree on a starting line. Take turns rolling toward the pins, count how many fall, and reset for the next player. Adjust the distance to suit each player and keep the playing area clear.',
      specifications: {
        productType: 'Kids bowling set',
        pins: 6,
        recommendedAge: '3 years and above',
        colourOptions: 'Red / Blue',
      },
      productFaq: [
        {
          question: 'Which colours can I choose?',
          answer:
            'The six-pin set is available in red and blue. Select the required set before adding it to your basket.',
        },
        {
          question: 'Does play require adult supervision?',
          answer:
            'Yes. This set is recommended for ages 3 and above, with adult assembly and supervision.',
        },
      ],
    },
    zh: {
      status: 'PUBLISHED',
      name: 'Strike! 儿童保龄球套装（6 瓶）',
      summary: '儿童六瓶保龄球套装，提供红色与蓝色款式。',
      skillLabels: { Coordination: '协调', Aiming: '瞄准' },
      description:
        '六瓶保龄球套装适合轮流投球、设定起点并瞄准共同目标。加入购物车前，可选择红色或蓝色套装。',
      ageGuidance: '建议 3 岁及以上使用。须由成人组装，并在成人看护下玩耍。',
      playGuide:
        '在平整地面摆好球瓶并约定起点。轮流朝球瓶滚球，数一数击倒的数量，再为下一位参与者重新摆好。根据参与者的情况调整距离，并保持游戏区域畅通。',
      specifications: {
        productType: { label: '商品类型', value: '儿童保龄球套装' },
        pins: { label: '球瓶数量', value: 6 },
        recommendedAge: { label: '建议年龄', value: '3 岁及以上' },
        colourOptions: { label: '可选颜色', value: '红色 / 蓝色' },
      },
      productFaq: [
        {
          question: '可以选择哪些颜色？',
          answer:
            '六瓶套装提供红色和蓝色款式，请在加入购物车前选择需要的款式。',
        },
        {
          question: '玩耍时需要成人看护吗？',
          answer:
            '需要。本套装建议 3 岁及以上使用，须由成人组装并在成人看护下玩耍。',
        },
      ],
      variants: {
        'WM-BOWL-06-A': { name: '6 瓶套装 / 红色' },
        'WM-BOWL-06-B': { name: '6 瓶套装 / 蓝色' },
      },
      seo: {
        title: '儿童保龄球套装（6 瓶）| WEMOVE SPORTS',
        description: '了解儿童六瓶保龄球套装的玩法、可选颜色与年龄指导。',
      },
    },
  },
  'balance-board-wooden-arc': {
    source: {
      name: 'Wooden Balance Board — Arc',
      summary: 'Demo Wooden Balance Board — Arc',
      skills: ['Balance', 'Coordination'],
      scenes: [],
      description:
        'A wooden balance board with an arc shape and natural finish. Explore controlled rocking and balance activities in a clear, level space with adult supervision.',
      ageGuidance:
        'Recommended for ages 3+. Use on a level surface with adult supervision.',
      playGuide:
        'Place the board on a level surface with enough clear space around it. With an adult nearby, begin with small, controlled movements and pause before changing position. Follow the instructions supplied with the product.',
      specifications: {
        productType: 'Arc balance board',
        material: 'Wood',
        finish: 'Natural',
        recommendedAge: '3 years and above',
      },
      productFaq: [
        {
          question: 'Where should I use the board?',
          answer:
            'Use the board on a level surface, with clear space around it and adult supervision.',
        },
        {
          question: 'Where can I check the load limit?',
          answer:
            'Check the instructions and markings supplied with your board before use. Contact support if this information is missing.',
        },
      ],
    },
    zh: {
      status: 'PUBLISHED',
      name: '弧形木质平衡板',
      summary: '原木色弧形平衡板，适合在成人看护下探索平衡活动。',
      skillLabels: { Balance: '平衡', Coordination: '协调' },
      description:
        '采用弧形外观与原木色款式的木质平衡板。在成人看护下，于平整且周围无障碍的空间探索轻缓摇摆与平衡活动。',
      ageGuidance: '建议 3 岁及以上使用。请在平整地面上使用，并由成人看护。',
      playGuide:
        '将平衡板放在平整地面上，确保周围留有足够空间。在成人陪同下从幅度较小、可控的动作开始，变换姿势前先停稳。使用时遵循随产品提供的说明。',
      specifications: {
        productType: { label: '商品类型', value: '弧形平衡板' },
        material: { label: '材质', value: '木质' },
        finish: { label: '款式', value: '原木色' },
        recommendedAge: { label: '建议年龄', value: '3 岁及以上' },
      },
      productFaq: [
        {
          question: '应该在哪里使用平衡板？',
          answer: '请在平整地面上使用，确保周围空间畅通，并由成人看护。',
        },
        {
          question: '在哪里查看承重限制？',
          answer:
            '使用前请查看随平衡板提供的说明和标识。如果缺少相关信息，请联系支持团队。',
        },
      ],
      variants: { 'WM-BAL-ARC-01': { name: '弧形平衡板 / 原木色' } },
      seo: {
        title: '弧形木质平衡板 | WEMOVE SPORTS',
        description: '查看弧形木质平衡板的玩法、规格与使用指导。',
      },
    },
  },
  'ring-toss-outdoor-game-set': {
    source: {
      name: 'Ring Toss Outdoor Game Set',
      summary: 'Demo Ring Toss Outdoor Game Set',
      skills: ['Coordination', 'Aiming'],
      scenes: ['Outdoor'],
      description:
        'A classic ring-toss set for outdoor play. Set a throwing line, take turns aiming at the target and adjust the distance for each participant.',
      ageGuidance:
        'Recommended for ages 4+. Adult supervision required during play.',
      playGuide:
        'Set up the target according to the supplied instructions in a clear outdoor area. Agree on a throwing line and take turns tossing rings toward the target. Collect the rings only after everyone has finished their turn.',
      specifications: {
        productType: 'Ring toss game set',
        setting: 'Outdoor',
        style: 'Classic',
        recommendedAge: '4 years and above',
      },
      productFaq: [
        {
          question: 'How can players adjust the challenge?',
          answer:
            'Move the throwing line nearer or farther away to suit the participants, while keeping the area around the target clear.',
        },
        {
          question: 'What is the recommended age?',
          answer:
            'This game is recommended for ages 4 and above. Adult supervision is required during play.',
        },
      ],
    },
    zh: {
      status: 'PUBLISHED',
      name: '户外套圈游戏套装',
      summary: '经典户外套圈游戏，可根据参与者调整投掷距离。',
      skillLabels: { Coordination: '协调', Aiming: '瞄准' },
      sceneLabels: { Outdoor: '户外' },
      description:
        '用于户外活动的经典套圈套装。设定投掷线后轮流瞄准目标，并根据不同参与者调整距离。',
      ageGuidance: '建议 4 岁及以上使用。玩耍过程中须由成人看护。',
      playGuide:
        '按照随附说明在畅通的户外区域设置目标。约定投掷线，轮流朝目标投圈；等所有参与者完成本轮投掷后，再一起捡回套圈。',
      specifications: {
        productType: { label: '商品类型', value: '套圈游戏套装' },
        setting: { label: '使用场景', value: '户外' },
        style: { label: '款式', value: '经典款' },
        recommendedAge: { label: '建议年龄', value: '4 岁及以上' },
      },
      productFaq: [
        {
          question: '如何调整游戏难度？',
          answer:
            '可以根据参与者情况将投掷线移近或移远，同时保持目标周围的区域畅通。',
        },
        {
          question: '适合多大的孩子使用？',
          answer: '本游戏建议 4 岁及以上使用，玩耍过程中须由成人看护。',
        },
      ],
      variants: { 'WM-TOSS-RING-01': { name: '经典套圈套装' } },
      seo: {
        title: '户外套圈游戏套装 | WEMOVE SPORTS',
        description: '查看户外套圈游戏的玩法、年龄指导与常见问题。',
      },
    },
  },
};

export function demoProductLocalePatch(
  row: DemoProductContent,
): Prisma.ProductUpdateInput {
  const demo = DEMO_PRODUCTS[row.slug];
  if (!demo) return {};
  const next = { ...row };
  for (const key of [
    'description',
    'playGuide',
    'productFaq',
    'skills',
    'scenes',
  ] as const)
    if (missing(row[key]))
      (next as JsonObject)[key] = structuredClone(demo.source[key]);
  const specs = fillMissingContent(
    row.specifications,
    demo.source.specifications,
  );
  const defaults = structuredClone(demo.zh);
  // Never label an editor's new source text as translated using unrelated demo copy.
  for (const key of [
    'name',
    'summary',
    'description',
    'ageGuidance',
    'playGuide',
    'productFaq',
  ])
    if (
      JSON.stringify((next as JsonObject)[key]) !==
      JSON.stringify(demo.source[key])
    )
      delete defaults[key];
  for (const key of Object.keys(defaults.specifications))
    if (
      JSON.stringify(specs[key]) !==
      JSON.stringify(demo.source.specifications[key])
    )
      delete defaults.specifications[key];
  const translations = object(specs.translations);
  const originalZh = object(translations.zh);
  const zh = fillMissingContent(originalZh, defaults);
  next.specifications = { ...specs, translations: { ...translations, zh } };
  if (
    missing(originalZh.status) &&
    !publishedProductLanguages(next).includes('zh')
  )
    zh.status = 'DRAFT';
  const patch: JsonObject = {};
  for (const key of [
    'description',
    'playGuide',
    'productFaq',
    'specifications',
    'skills',
    'scenes',
  ] as const)
    if (JSON.stringify(row[key]) !== JSON.stringify(next[key]))
      patch[key] = next[key];
  return patch as Prisma.ProductUpdateInput;
}

const CATEGORIES = {
  BOWLING: { name: '儿童保龄球', description: '浏览儿童保龄球套装与玩法。' },
  BALANCE: { name: '平衡与协调', description: '探索平衡板与协调活动。' },
  OUTDOOR: {
    name: '户外投掷游戏',
    description: '浏览适合户外活动的投掷与套圈游戏。',
  },
};

/** Targeted demo update: no accounts, prices, stock, or existing translations are reset. */
export async function seedCatalogLocales(prisma: PrismaClient) {
  if (process.env.DEPLOYMENT_ENV === 'production') return [];
  const results: Array<{
    slug: string;
    updated: boolean;
    languages: string[];
  }> = [];
  await prisma.$transaction(async (tx) => {
    for (const slug of Object.keys(DEMO_PRODUCTS)) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE slug = ${slug} FOR UPDATE`;
      const row = await tx.product.findUnique({ where: { slug } });
      if (!row) continue;
      const patch = demoProductLocalePatch(row);
      const result = Object.keys(patch).length
        ? await tx.product.update({ where: { id: row.id }, data: patch })
        : row;
      results.push({
        slug,
        updated: Object.keys(patch).length > 0,
        languages: publishedProductLanguages(result),
      });
    }
    for (const [code, translation] of Object.entries(CATEGORIES)) {
      await tx.$queryRaw`SELECT id FROM "ProductCategory" WHERE code = ${code} FOR UPDATE`;
      const row = await tx.productCategory.findUnique({ where: { code } });
      if (!row) continue;
      const seo = fillMissingContent(row.seo, {
        translations: { zh: { status: 'PUBLISHED', ...translation } },
      });
      if (JSON.stringify(seo) !== JSON.stringify(row.seo))
        await tx.productCategory.update({
          where: { id: row.id },
          data: { seo },
        });
    }
  });
  return results;
}

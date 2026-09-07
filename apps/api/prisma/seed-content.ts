import type { PrismaClient, Prisma } from '@prisma/client';
const block = (type: string, props: Prisma.InputJsonObject) => ({
  type,
  props,
});
export async function seedContent(prisma: PrismaClient) {
  if (process.env.DEPLOYMENT_ENV === 'production') return;
  const pages = [
    {
      slug: 'home',
      title: 'WEMOVE SPORTS',
      kind: 'HOME',
      sections: [
        block('hero', {
          title: 'Play starts with moving.',
          text: 'Thoughtful sports toys for confident movement at home, at school and outside.',
          image: '/images/wemove-active-play-hero.png',
          alt: 'Active play toys arranged on a sports court',
          href: '/products',
          label: 'Explore products',
        }),
        block('products', { title: 'Find their kind of play' }),
        block('values', {
          title: 'Make room for movement',
          items: [
            {
              title: 'Built to move',
              text: 'Games that invite active participation.',
            },
            {
              title: 'Play together',
              text: 'Discover activities for families and friends.',
            },
            {
              title: 'Choose with confidence',
              text: 'Read age guidance and product instructions before play.',
            },
          ],
        }),
        block('articles', { title: 'Play and learn' }),
        block('cta', {
          title: 'For retailers and partners',
          text: 'Explore our dealer programme and wholesale catalogue.',
          href: '/dealer/apply',
          label: 'Become a dealer',
        }),
        block('cta', {
          title: 'Quality and safety',
          text: 'Find instructions and safety information for each product.',
          href: '/quality-safety',
          label: 'Read the guidance',
        }),
        block('newsletter', {}),
      ],
    },
    {
      slug: 'about',
      title: 'About WEMOVE SPORTS',
      kind: 'PAGE',
      sections: [
        block('text', {
          title: 'Active play for everyday life',
          text: 'WEMOVE SPORTS brings movement into family play through sports games, balance activities and outdoor toys. Explore the product catalogue to find age guidance, specifications and instructions.',
        }),
        block('cta', {
          title: 'Talk with our team',
          text: 'For product questions or business enquiries, use our contact form.',
          href: '/contact',
          label: 'Contact us',
        }),
      ],
    },
    {
      slug: 'quality-safety',
      title: 'Quality and safety',
      kind: 'PAGE',
      sections: [
        block('text', {
          title: 'Before you play',
          text: 'Read the instructions supplied with each product. Check age guidance and warnings, inspect parts before use, and choose a suitable space. Adult supervision may be required as specified in the product instructions.',
        }),
        block('text', {
          title: 'Product documentation',
          text: 'Safety information and certificates must be checked for the specific product and market. Contact our team if the documentation you need is not available in Downloads.',
        }),
        block('download', {
          title: 'Instructions and resources',
          href: '/support/downloads',
          label: 'Open downloads',
        }),
      ],
    },
    {
      slug: 'privacy',
      title: 'Privacy information',
      kind: 'PAGE',
      sections: [
        block('text', {
          title: 'Information used by this portal',
          text: 'The portal uses account details to provide sign-in, addresses to fulfil orders, and contact messages to respond to requests. Dealer applications include business and qualification information. The website is intended for adults and does not request children’s personal information.',
        }),
        block('text', {
          title: 'Your choices',
          text: 'You can edit your profile, export your account information, manage marketing preferences and request account deletion from your account. Transaction records may need to be retained while an order or service request remains active.',
        }),
        block('cta', {
          title: 'Cookie choices',
          text: 'Optional analytics start only after your consent. Essential cookies support security and sign-in.',
          href: '/cookies',
          label: 'Manage cookies',
        }),
        block('cta', {
          title: 'Privacy enquiries',
          href: '/contact',
          label: 'Contact support',
        }),
      ],
    },
    {
      slug: 'terms',
      title: 'Website terms',
      kind: 'PAGE',
      sections: [
        block('text', {
          title: 'Using the portal',
          text: 'Use your own accurate contact information, protect your sign-in details and access only information your account is authorised to view. Product specifications, age guidance, availability and commercial terms are shown in the relevant product or order.',
        }),
        block('text', {
          title: 'Orders and quotations',
          text: 'Review the currency, delivery address, quantities and total before confirming. Dealer quotations are valid only until the stated expiry date. Payment and shipping status are displayed in your order history.',
        }),
        block('cta', {
          title: 'Questions about an order',
          href: '/contact',
          label: 'Contact support',
        }),
      ],
    },
    {
      slug: 'article-active-family-play',
      title: 'Getting started with active family play',
      kind: 'ARTICLE',
      sections: [
        block('text', {
          title: 'Start with a clear space',
          text: 'Choose a level area away from traffic and obstacles. Read the product’s instructions together and agree on the playing boundary.',
        }),
        block('list', {
          title: 'Keep everyone involved',
          items: [
            'Take turns setting a simple target.',
            'Adjust the distance to suit each participant.',
            'Pause when a player needs a break.',
          ],
        }),
        block('products', { title: 'Explore active play toys' }),
      ],
    },
    {
      slug: 'faq-instructions',
      title: 'Where can I find product instructions?',
      kind: 'FAQ',
      sections: [
        block('text', {
          text: 'Open the product page or browse the Downloads centre. If the document is missing, contact support with the product name or SKU.',
        }),
      ],
    },
  ];
  for (const p of pages)
    await prisma.cmsPage.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...p,
        status: 'PUBLISHED',
        seo: { description: p.title },
        author: 'WEMOVE SPORTS',
      },
    });
  const zhHome = [
    block('hero', {
      title: '从运动开始玩乐',
      text: '为家庭、学校与户外活动提供运动玩具，让孩子在玩乐中探索平衡与协调。',
      image: '/images/wemove-active-play-hero.png',
      alt: '运动场上的玩具组合',
      href: '/zh/products',
      label: '浏览产品',
    }),
    block('products', { title: '发现适合的玩法' }),
    block('cta', {
      title: '经销合作',
      text: '查看经销商申请与采购服务。',
      href: '/dealer/apply',
      label: '申请成为经销商',
    }),
    block('newsletter', {}),
  ];
  const home = await prisma.cmsPage.findUnique({ where: { slug: 'home' } });
  if (home && Object.keys((home.translations as object) ?? {}).length === 0)
    await prisma.cmsPage.update({
      where: { id: home.id },
      data: {
        translations: {
          zh: {
            status: 'PUBLISHED',
            title: 'WEMOVE SPORTS 运动玩乐',
            sections: zhHome,
            seo: { description: '探索 WEMOVE SPORTS 运动玩具与亲子玩法' },
          },
        },
      },
    });
}

import type { Prisma } from '@prisma/client';
const block = (type: string, props: Prisma.InputJsonObject) => ({
  type,
  props,
});
export const demoContentPages = [
  {
    slug: 'home',
    title: 'WEMOVE｜原木滚珠轨道积木、STEM教育与木作创新',
    kind: 'HOME',
    locale: 'zh',
    sections: [
      block('original-feature', {
        id: 'wemove-set', title: 'WEMOVE套装',
        text: '探索完整的 WEMOVE 系列，领略其丰富的形态与多彩的世界。',
        image: '/original-site/home-stem.png', alt: 'WEMOVE STANDARD 50 实木滚珠轨道积木套装',
        href: '/workshop', label: '即刻探索', tone: 'white', imageSide: 'left',
      }),
      block('original-feature', {
        id: 'stem', title: 'STEM教育',
        text: '把知识藏进滚珠轨道的游戏里。孩子在动手搭建、调整路径的过程中，自然理解物理规律与工程思维，在一次次试错里收获解决问题的能力与创造的自信。',
        image: '/original-site/home-furniture.jpg', alt: 'WEMOVE 木制滚珠轨道与彩色滚珠',
        href: '/stem', label: '即刻探索', tone: 'green', imageSide: 'right',
      }),
      block('original-feature', {
        id: 'furniture', title: '原木家具',
        text: '以天然木色为底色，把模块化创意揉进日常场景。每一件家具都能自由拼接、灵活适配，在实用与美学的平衡里，为生活空间注入灵动和温度。',
        image: '/original-site/home-prototyping.png', alt: 'WEMOVE 原木家具',
        href: '/furniture', label: '即刻探索', tone: 'white', imageSide: 'left',
      }),
      block('original-feature', {
        id: 'prototyping', title: 'WEMOVE中试',
        text: 'WEMOVE中试平台，是你创意落地的专业打板伙伴。你只需提供样式与构想，我们便为你完成从原型到成品的工艺打磨、样品打板与稳定性验证，让设计平稳过渡到规模化生产。',
        image: '/original-site/home-research.png', alt: 'WEMOVE 原木中试打样场景',
        href: '/woodlab', label: '即刻探索', tone: 'green', imageSide: 'right',
      }),
      block('original-feature', {
        id: 'research', title: 'WEMOVE科研',
        text: '作为步入学术课堂的理想起点，科研论文能让你轻松开启知识沉淀与传播乐趣。你可以用严谨逻辑、创新观点和实证分析，在学术交流中传递研究价值与思想力量。',
        image: '/original-site/home-learning.png', alt: 'WEMOVE 木制机械研究装置',
        href: '/library', label: '即刻探索', tone: 'white', imageSide: 'left',
      }),
      block('original-feature', {
        id: 'learning', title: 'WEMOVE 让学习变成一种游戏',
        text: '一块块原木积木既是轨道，也是孩子理解重力、速度与结构的入口。自由组合、反复验证，让好奇心在真实的滚动中不断发生。',
        image: '/original-site/home-wemove-set.png', alt: 'WEMOVE 原木积木搭建场景',
        tone: 'green', imageSide: 'right',
      }),
      block('original-feature', {
        id: 'digital', title: '获得灵感，加入WEMOVE数字模拟',
        text: '在数字世界里复刻真实轨道的每一次滚动，让复杂规律在可视化推演中一目了然。',
        image: '/original-site/home-digital.jpg', alt: 'WEMOVE 数字模拟灵感场景',
        href: 'https://waymove.net/', label: '即刻探索', tone: 'white', imageSide: 'left',
      }),
    ],
  },
  {
    slug: 'about',
    title: 'About WEMOVE',
    kind: 'PAGE',
    sections: [
      block('text', {
        title: 'Wood, movement and open-ended learning',
        text: 'WEMOVE creates wooden marble runs, mechanism modules and learning experiences that make motion visible. Explore the original product range for age guidance, specifications and available instructions.',
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
    slug: 'furniture',
    title: '家具定制',
    kind: 'PAGE',
    locale: 'zh',
    sections: [
      block('hero', {
        title: '原木家具',
        text: '以天然木色为底色，把模块化创意揉进日常场景。我们提供需求沟通、结构建议与木作定制服务。',
        image: '/original-site/home-prototyping.png',
        alt: 'WEMOVE 原木家具',
        href: '/contact',
        label: '提交定制需求',
      }),
    ],
  },
  {
    slug: 'woodlab',
    title: '中试打样',
    kind: 'PAGE',
    locale: 'zh',
    sections: [
      block('hero', {
        title: 'WEMOVE中试',
        text: '从构想到样品，完成工艺评估、结构打样与稳定性验证。项目需求可通过咨询表单进入现有线索与工单流程。',
        image: '/original-site/home-research.png',
        alt: 'WEMOVE 木作中试场景',
        href: '/contact',
        label: '发起打样咨询',
      }),
    ],
  },
  {
    slug: 'library',
    title: '科研研发',
    kind: 'PAGE',
    locale: 'zh',
    sections: [
      block('hero', {
        title: 'WEMOVE科研',
        text: '围绕滚珠轨道、机械结构与游戏化学习沉淀研究内容，并通过内容中心持续发布。',
        image: '/original-site/home-learning.png',
        alt: 'WEMOVE 木制机械研究装置',
        href: '/play-learn',
        label: '查看学习内容',
      }),
      block('articles', { title: '研究与学习内容' }),
    ],
  },
  {
    slug: 'public-benefit',
    title: '公益项目',
    kind: 'PAGE',
    locale: 'zh',
    sections: [
      block('text', {
        title: '让更多孩子接触动手学习',
        text: 'WEMOVE 公益项目面向学校、社区与合作机构。合作意向将通过现有咨询与运营后台统一处理。',
      }),
      block('cta', { title: '公益合作', href: '/contact', label: '联系我们' }),
    ],
  },
  {
    slug: 'craft-dream',
    title: '匠心筑梦',
    kind: 'PAGE',
    locale: 'zh',
    sections: [
      block('text', {
        title: '从一块木头到一条会滚动的轨道',
        text: '材料选择、曲线加工、圆角打磨与结构验证，共同构成 WEMOVE 的木作过程。这里将由 CMS 持续发布品牌与工艺故事。',
      }),
      block('articles', { title: '品牌与工艺故事' }),
    ],
  },
  {
    slug: 'article-active-family-play',
    title: 'Getting started with a wooden marble run',
    kind: 'ARTICLE',
    sections: [
      block('text', {
        title: 'Start with a stable base',
        text: 'Build on a level surface, place the first track sections securely and read the product guidance before adding marbles.',
      }),
      block('list', {
        title: 'Build, test and adjust',
        items: [
          'Test a short path before adding height.',
          'Change one block at a time when a marble stops.',
          'Keep small balls away from children below the stated age.',
        ],
      }),
      block('products', { title: 'Explore WEMOVE marble runs' }),
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

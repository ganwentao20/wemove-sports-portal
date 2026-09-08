import { seedContent } from './seed-content.ts';
import { seedCatalogLocales } from './seed-catalog-locales.ts';
/**
 * WEMOVE SPORTS · 基础 Seed（幂等，可重复执行）
 *
 * 职责（组员 E 扩展为真实商品/分类测试数据）：
 * 1. RBAC 基座：权限点 + SUPER_ADMIN 角色 + 引导管理员
 * 2. 演示账号：customer / dealer 两个 C 端账号（密码见下，仅本地）
 * 3. 演示目录：3 个分类 × 3 个商品（含变体 SKU、零售价/B2B 默认价、等级价规则）
 *
 * 运行：仓库根 `npm run db:seed`（apps/api 目录内 node prisma/seed.ts）
 * 依赖：apps/api/.env 中 DATABASE_URL（docker compose 的 postgres 已启动）
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STAFF_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@wemove.local';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Demo1234';
const STAFF_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? DEMO_PASSWORD;

/** 权限点清单（组内新增模块时在此登记权限编码，与代码中的 PermissionCode 常量同步） */
const PERMISSIONS: Array<{ code: string; name: string; group: string }> = [
  { code: 'system:staff:read', name: '查看员工', group: 'system' },
  { code: 'system:staff:write', name: '管理员工与角色', group: 'system' },
  { code: 'system:audit:read', name: '查看审计日志', group: 'system' },
  { code: 'catalog:product:read', name: '查看商品', group: 'catalog' },
  { code: 'catalog:product:write', name: '管理商品与变体', group: 'catalog' },
  { code: 'catalog:price:write', name: '维护价格规则', group: 'catalog' },
  { code: 'cms:page:write', name: '管理 CMS 页面与首页模块', group: 'cms' },
  { code: 'cms:media:write', name: '管理媒体资源', group: 'cms' },
  { code: 'cms:contact:manage', name: '处理联系线索', group: 'cms' },
  { code: 'b2b:dealer:review', name: '审核经销商申请', group: 'b2b' },
  { code: 'b2b:dealer:read', name: '查看经销商数据', group: 'b2b' },
  { code: 'b2b:rfq:manage', name: '处理询价报价', group: 'b2b' },
  { code: 'order:read', name: '查看订单', group: 'order' },
  { code: 'order:write', name: '订单履约与退款', group: 'order' },
];

async function seedRbac() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, group: p.group },
      create: p,
    });
  }

  const allPerms = await prisma.permission.findMany({ select: { id: true } });
  const role = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: { name: '超级管理员' },
    create: {
      code: 'SUPER_ADMIN',
      name: '超级管理员',
      description: '全权限（种子演示）',
      permissions: {
        create: allPerms.map((p: any) => ({ permissionId: p.id })),
      },
    },
    include: { permissions: true },
  });
  // 幂等：增量补齐权限
  const existing = new Set(role.permissions.map((rp: any) => rp.permissionId));
  const missing = allPerms.filter((p: any) => !existing.has(p.id));
  if (missing.length > 0) {
    await prisma.rolePermission.createMany({
      data: missing.map((p: any) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  const passwordHash = await bcrypt.hash(STAFF_PASSWORD, 12);
  const staff = await prisma.staff.upsert({
    where: { email: STAFF_EMAIL },
    update: { status: 'ACTIVE', passwordHash },
    create: {
      email: STAFF_EMAIL,
      name: 'Seed Admin',
      passwordHash,
      roles: { create: [{ roleId: role.id }] },
    },
  });

  // 演示角色：商品运营（非超管示例 —— 供员工角色分配/越权演示）
  const operatorCodes = [
    'catalog:product:read',
    'catalog:product:write',
    'catalog:price:write',
  ];
  const operatorPerms = await prisma.permission.findMany({
    where: { code: { in: operatorCodes } },
  });
  const operatorRole = await prisma.role.upsert({
    where: { code: 'CATALOG_OPERATOR' },
    update: { name: '商品运营' },
    create: {
      code: 'CATALOG_OPERATOR',
      name: '商品运营',
      description: '商品/价格维护（演示角色）',
      permissions: {
        create: operatorPerms.map((p: any) => ({ permissionId: p.id })),
      },
    },
    include: { permissions: true },
  });
  const opExisting = new Set(
    operatorRole.permissions.map((rp: any) => rp.permissionId),
  );
  const opMissing = operatorPerms.filter((p: any) => !opExisting.has(p.id));
  if (opMissing.length > 0) {
    await prisma.rolePermission.createMany({
      data: opMissing.map((p: any) => ({
        roleId: operatorRole.id,
        permissionId: p.id,
      })),
    });
  }

  console.log(
    `[rbac] permissions=${allPerms.length} role=${role.code} operator=${operatorRole.code} admin=${staff.email}`,
  );
}

async function seedDemoAccounts() {
  const hashCustomer = await bcrypt.hash(DEMO_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: 'customer@wemove.local' },
    update: { passwordHash: hashCustomer, status: 'ACTIVE' },
    create: {
      email: 'customer@wemove.local',
      name: 'Demo Customer',
      passwordHash: hashCustomer,
      ageConfirmed: true,
      status: 'ACTIVE',
    },
  });
  await prisma.user.upsert({
    where: { email: 'dealer@wemove.local' },
    update: { passwordHash: hashCustomer, status: 'ACTIVE' },
    create: {
      email: 'dealer@wemove.local',
      name: 'Demo Dealer Buyer',
      passwordHash: hashCustomer,
      ageConfirmed: true,
      status: 'ACTIVE',
    },
  });
  console.log(
    `[demo] customer@wemove.local / dealer@wemove.local (pwd ${DEMO_PASSWORD})`,
  );
}

async function seedCatalog() {
  for (const market of [
    { code: 'US', label: 'United States', currency: 'USD', countries: ['US'] },
    { code: 'CN', label: 'China', currency: 'CNY', countries: ['CN'] },
  ]) {
    await prisma.retailMarket.upsert({
      where: { code: market.code },
      update: {
        label: market.label,
        currency: market.currency,
        countries: market.countries,
        retailEnabled: true,
      },
      create: { ...market, retailEnabled: true },
    });
  }
  const cats: Array<{ code: string; slug: string; name: string; nameZh: string }> = [
    { code: 'WEMOVE', slug: 'marble-run-blocks', name: 'Marble Run Blocks', nameZh: '积木玩具' },
  ];
  const catIds = new Map<string, string>();
  for (const c of cats) {
    const row = await prisma.productCategory.upsert({
      where: { code: c.code },
      update: {
        slug: c.slug,
        name: c.name,
        active: true,
        seo: {
          translations: {
            zh: { status: 'PUBLISHED', name: c.nameZh },
          },
        },
      },
      create: {
        code: c.code,
        slug: c.slug,
        name: c.name,
        seo: {
          translations: {
            zh: { status: 'PUBLISHED', name: c.nameZh },
          },
        },
      },
    });
    catIds.set(c.code, row.id);
  }

  const products: Array<{
    slug: string;
    name: string;
    nameEn: string;
    summary: string;
    summaryEn: string;
    description: string;
    descriptionEn: string;
    image: string;
    category: string;
    ageMin: number;
    ageGuidance: string;
    ageGuidanceEn: string;
    specifications: Record<string, string>;
    specificationsZh: Record<string, string>;
    variants: Array<{
      sku: string;
      name: string;
      nameEn: string;
      msrp: number; // 分
      sale: number;
      b2b: number;
      stock: number;
    }>;
  }> = [
    {
      slug: 'standard-50',
      name: '50块标准款套装',
      nameEn: 'WEMOVE Standard 50',
      summary: '德国进口AA级榉木材料，通过先进的曲线烘干技术，使积木产品材质刚硬、木纹美观、环保。',
      summaryEn: 'A 50-piece beechwood marble run set for open-ended building and hands-on exploration.',
      description: '这款50块标准款实木滚珠轨道积木，以天然榉木打造，温润无漆，边角圆润安全。积木自带凹槽、弯道、圆孔等轨道结构，可自由拼接成立体迷宫或城堡式滚珠路径，让彩色玻璃珠在重力驱动下穿梭滑行，在搭建与试玩中锻炼空间思维与逻辑能力，同时可与同品牌机关套兼容拓展，是兼具质感与教育价值的开放式益智玩具。',
      descriptionEn: 'Natural beechwood blocks combine grooves, curves and openings into freely configurable marble paths. The set works with WEMOVE mechanism modules for further expansion.',
      image: '/original-site/product-standard-50.jpg',
      category: 'WEMOVE',
      ageMin: 3,
      ageGuidance: '建议3岁以上儿童在成人监护下使用；内含小球，请避免吞咽。',
      ageGuidanceEn: 'For ages 3 and above with adult supervision. Contains small balls.',
      specifications: { Material: 'Beechwood', Finish: 'Natural unpainted wood', Contents: '50 building blocks', Compatibility: 'WEMOVE mechanism modules' },
      specificationsZh: { Material: '材质|榉木', Finish: '表面处理|原木无漆', Contents: '套装内容|50块积木', Compatibility: '兼容性|WEMOVE机关模块' },
      variants: [
        {
          sku: 'WM-STANDARD-50',
          name: '标准50块套装',
          nameEn: 'Standard 50-piece set',
          msrp: 69900,
          sale: 69900,
          b2b: 48900,
          stock: 50,
        },
      ],
    },
    {
      slug: 'cugolino-basic',
      name: 'Cugolino Basic',
      nameEn: 'Cugolino Basic',
      summary: '易拼接融入建筑，美学启蒙空间思维。',
      summaryEn: 'A foundation set focused on clear track building and spatial exploration.',
      description: '作为基础套，它摒弃了复杂的机械机关，聚焦滚珠轨道的核心拼接逻辑，组件以基础轨道、支撑结构和趣味节点为核心，包含直轨、弯轨、分叉轨等基础轨道块，以及带圆孔的穿透式积木、弧形过渡件，可自由拼接成平面或立体的滚珠路径。',
      descriptionEn: 'Straight, curved and branching tracks combine with supports and transition blocks to create flat or three-dimensional marble paths.',
      image: '/original-site/product-cugolino-basic.jpg',
      category: 'WEMOVE',
      ageMin: 3,
      ageGuidance: '建议3岁以上儿童在成人监护下使用。',
      ageGuidanceEn: 'For ages 3 and above with adult supervision.',
      specifications: { Material: 'Wood', ProductType: 'Foundation marble run set', TrackElements: 'Straight, curved and branching tracks' },
      specificationsZh: { Material: '材质|木材', ProductType: '产品类型|基础滚珠轨道套装', TrackElements: '轨道组件|直轨、弯轨和分叉轨' },
      variants: [
        {
          sku: 'WM-CUGOLINO-BASIC',
          name: '基础套装',
          nameEn: 'Basic set',
          msrp: 45900,
          sale: 45900,
          b2b: 32100,
          stock: 40,
        },
      ],
    },
    {
      slug: 'large-pendulum-set',
      name: '大摆锤套',
      nameEn: 'Large Pendulum Set',
      summary: '原木无漆，立体轨道构建。',
      summaryEn: 'An unpainted wooden mechanism module for three-dimensional marble runs.',
      description: '长斜坡是轨道主体，小球可从高处滑下并经过不同机关。大摆锤结构是可摆动的木质装置，当小球经过时被触发，实现小球的传递或转向。',
      descriptionEn: 'A long slope carries the marble into a moving wooden pendulum that can transfer or redirect it into the next track section.',
      image: '/original-site/product-large-pendulum.jpg',
      category: 'WEMOVE',
      ageMin: 3,
      ageGuidance: '建议3岁以上儿童在成人监护下使用。',
      ageGuidanceEn: 'For ages 3 and above with adult supervision.',
      specifications: { Material: 'Natural wood', Mechanism: 'Moving pendulum', Compatibility: 'WEMOVE marble run sets' },
      specificationsZh: { Material: '材质|天然木材', Mechanism: '机关|摆锤传递与转向', Compatibility: '兼容性|WEMOVE滚珠轨道套装' },
      variants: [
        {
          sku: 'WM-LARGE-PENDULUM', name: '大摆锤模块', nameEn: 'Large pendulum module', msrp: 18900, sale: 18900, b2b: 13200, stock: 35,
        },
      ],
    },
    {
      slug: 'small-turntable-set', name: '小转盘套', nameEn: 'Small Turntable Set', summary: '可与其他套装积木组合搭建。', summaryEn: 'A compact turntable mechanism that combines with other WEMOVE sets.',
      description: '顶部的弧形凹槽转盘是这套机关的特色。彩色小球滚入后会在转盘内滚动、停留，并通过搭建实现转向或触发下一段轨道。',
      descriptionEn: 'A curved turntable receives the marble, changes its direction and releases it into the next section of a custom track.',
      image: '/original-site/product-small-turntable.jpg', category: 'WEMOVE', ageMin: 3, ageGuidance: '建议3岁以上儿童在成人监护下使用。', ageGuidanceEn: 'For ages 3 and above with adult supervision.',
      specifications: { Material: 'Wood', Mechanism: 'Turntable', Compatibility: 'WEMOVE marble run sets' }, specificationsZh: { Material: '材质|木材', Mechanism: '机关|转盘转向', Compatibility: '兼容性|WEMOVE滚珠轨道套装' },
      variants: [{ sku: 'WM-SMALL-TURNTABLE', name: '小转盘模块', nameEn: 'Small turntable module', msrp: 16900, sale: 16900, b2b: 11800, stock: 35 }],
    },
    {
      slug: 'elevator', name: '电梯', nameEn: 'Elevator', summary: '拼装简单，齿轮联动，机械感十足；多轨道循环，运行流畅。', summaryEn: 'A hand-operated geared elevator for lifting marbles between track levels.',
      description: '电梯积木允许孩子通过构建和操作模拟电梯系统来理解机械原理和物理法则。套装包含多个部件，可自行组装并体验手动控制电梯上下移动的过程。',
      descriptionEn: 'Children assemble and operate a manual lift to explore gears, movement and multi-level track design.',
      image: '/original-site/product-elevator.jpg', category: 'WEMOVE', ageMin: 6, ageGuidance: '建议6岁以上儿童在成人指导下搭建与使用。', ageGuidanceEn: 'For ages 6 and above with adult guidance.',
      specifications: { Material: 'Wood', Mechanism: 'Hand-operated geared lift', Compatibility: 'Multi-level WEMOVE tracks' }, specificationsZh: { Material: '材质|木材', Mechanism: '机关|手动齿轮升降', Compatibility: '兼容性|WEMOVE多层轨道' },
      variants: [{ sku: 'WM-ELEVATOR', name: '齿轮电梯模块', nameEn: 'Geared elevator module', msrp: 29900, sale: 29900, b2b: 20900, stock: 24 }],
    },
    {
      slug: 'magnetic-cannon', name: '电磁炮', nameEn: 'Magnetic Cannon', summary: '木制安全无异味，咔哒磁吸声，拼搭中玩出小智慧。', summaryEn: 'A magnetic mechanism module for experimenting with marble launch and transfer.',
      description: '磁力炮积木利用磁力原理，让孩子们通过构建能够发射小球的机械装置探索物理学的魅力，并锻炼工程思维与解决问题的能力。',
      descriptionEn: 'The module uses magnetic force to release a marble and demonstrate cause, motion and simple mechanical design.',
      image: '/original-site/product-magnetic-cannon.jpg', category: 'WEMOVE', ageMin: 6, ageGuidance: '含磁性部件和小球，建议6岁以上儿童在成人监护下使用。', ageGuidanceEn: 'Contains magnetic parts and small balls. For ages 6 and above with adult supervision.',
      specifications: { Material: 'Wood with magnetic components', Mechanism: 'Magnetic marble release', Compatibility: 'WEMOVE marble run sets' }, specificationsZh: { Material: '材质|木材与磁性部件', Mechanism: '机关|磁力弹珠释放', Compatibility: '兼容性|WEMOVE滚珠轨道套装' },
      variants: [{ sku: 'WM-MAGNETIC-CANNON', name: '磁力机关模块', nameEn: 'Magnetic mechanism module', msrp: 21900, sale: 21900, b2b: 15300, stock: 28 }],
    },
    {
      slug: 'snake-track-set', name: '蛇形套装', nameEn: 'Snake Track Set', summary: '蛇形轨道蜿蜒丰富玩法，直观展示弹珠滚动轨迹。', summaryEn: 'A winding track module that makes a marble path easy to observe.',
      description: '蛇形套装依托蜿蜒曲折的轨道设计，让孩子们在拼搭与玩赏中，直观探索物体运动的轨迹规律与空间路径逻辑。',
      descriptionEn: 'The winding path helps children observe movement and experiment with how a track shape changes the marble route.',
      image: '/original-site/product-snake-track.jpg', category: 'WEMOVE', ageMin: 3, ageGuidance: '建议3岁以上儿童在成人监护下使用。', ageGuidanceEn: 'For ages 3 and above with adult supervision.',
      specifications: { Material: 'Wood', TrackType: 'Winding snake track', Compatibility: 'WEMOVE marble run sets' }, specificationsZh: { Material: '材质|木材', TrackType: '轨道类型|蛇形轨道', Compatibility: '兼容性|WEMOVE滚珠轨道套装' },
      variants: [{ sku: 'WM-SNAKE-TRACK', name: '蛇形轨道模块', nameEn: 'Snake track module', msrp: 19900, sale: 19900, b2b: 13900, stock: 30 }],
    },
  ];

  await prisma.product.updateMany({
    where: {
      slug: { in: ['strike-kids-bowling-set-6-pin', 'balance-board-wooden-arc', 'ring-toss-outdoor-game-set'] },
    },
    data: { status: 'ARCHIVED' },
  });
  await prisma.productCategory.updateMany({
    where: { code: { in: ['BOWLING', 'BALANCE', 'OUTDOOR'] } },
    data: { active: false },
  });

  const goldTier = await prisma.dealerTier.upsert({
    where: { code: 'gold' },
    update: { name: 'Gold' },
    create: { code: 'gold', name: 'Gold', sortOrder: 2 },
  });

  for (const p of products) {
    const zhTranslation = {
      translations: {
        zh: {
          status: 'PUBLISHED',
          name: p.name,
          summary: p.summary,
          description: p.description,
          ageGuidance: p.ageGuidance,
          tagLabels: { wooden: '原木', 'marble-run': '滚珠轨道' },
          skillLabels: {
            Engineering: '工程思维',
            'Spatial thinking': '空间思维',
          },
          sceneLabels: { Family: '家庭', School: '学校' },
          variants: Object.fromEntries(
            p.variants.map((variant) => [
              variant.sku,
              { name: variant.name },
            ]),
          ),
          specifications: Object.fromEntries(
            Object.entries(p.specificationsZh).map(([key, entry]) => {
              const [label, value] = entry.split('|', 2);
              return [key, { label, value }];
            }),
          ),
        },
      },
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.nameEn,
        summary: p.summaryEn,
        description: p.descriptionEn,
        ageGuidance: p.ageGuidanceEn,
        categoryId: catIds.get(p.category),
        gallery: [{ url: p.image, alt: p.nameEn, sort: 0 }],
        ageMin: p.ageMin,
        scenes: ['Family', 'School'],
        skills: ['Engineering', 'Spatial thinking'],
        tags: ['wooden', 'marble-run'],
        specifications: { ...p.specifications, ...zhTranslation },
        status: 'ACTIVE',
      },
      create: {
        slug: p.slug,
        name: p.nameEn,
        summary: p.summaryEn,
        description: p.descriptionEn,
        ageGuidance: p.ageGuidanceEn,
        categoryId: catIds.get(p.category),
        gallery: [{ url: p.image, alt: p.nameEn, sort: 0 }],
        ageMin: p.ageMin,
        scenes: ['Family', 'School'],
        skills: ['Engineering', 'Spatial thinking'],
        tags: ['wooden', 'marble-run'],
        specifications: { ...p.specifications, ...zhTranslation },
        status: 'ACTIVE',
      },
    });

    for (const v of p.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          name: v.nameEn,
          msrpCents: v.msrp,
          salePriceCents: v.sale,
          b2bDefaultPriceCents: v.b2b,
        },
        create: {
          sku: v.sku,
          name: v.nameEn,
          productId: product.id,
          msrpCents: v.msrp,
          salePriceCents: v.sale,
          b2bDefaultPriceCents: v.b2b,
        },
      });
      await prisma.stock.upsert({
        where: { variantId: variant.id },
        update: {},
        create: { variantId: variant.id, available: v.stock },
      });

      // 示例价格规则：Gold 等级价（TIER_LEVEL）
      const existing = await prisma.pricingRule.findFirst({
        where: {
          variantId: variant.id,
          scope: 'TIER_LEVEL',
          tierId: goldTier.id,
        },
      });
      if (!existing) {
        await prisma.pricingRule.create({
          data: {
            variantId: variant.id,
            scope: 'TIER_LEVEL',
            tierId: goldTier.id,
            priceCents: Math.round(v.b2b * 0.9),
            note: 'Seed demo: gold tier price',
          },
        });
      }
    }
  }
  console.log('[catalog] original WEMOVE category/products seeded (1/7)');
}

async function seedDemoCompany() {
  const user = await prisma.user.findUnique({
    where: { email: 'dealer@wemove.local' },
  });
  if (!user) return;
  const tier = await prisma.dealerTier.findUnique({ where: { code: 'gold' } });
  const company = await prisma.dealerCompany.upsert({
    where: { id: 'demo-company-1' },
    update: {},
    create: {
      id: 'demo-company-1',
      companyName: 'Demo Toys Ltd.',
      legalRegNo: 'DEMO-2026-0001',
      country: 'US',
      status: 'APPROVED',
      tierId: tier?.id ?? null,
      approvedAt: new Date(),
    },
  });
  await prisma.dealerMember.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    update: { role: 'BUYER' },
    create: { companyId: company.id, userId: user.id, role: 'BUYER' },
  });
  console.log('[demo] dealer company approved + buyer membership');
}

async function main() {
  await seedRbac();
  await seedDemoAccounts();
  await seedCatalog();
  await seedCatalogLocales(prisma);
  await seedDemoCompany();
  await seedContent(prisma);
  console.log('Seed completed ✓');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

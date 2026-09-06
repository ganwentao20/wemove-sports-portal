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
const STAFF_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

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
    update: { status: 'ACTIVE' },
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
  const hashCustomer = await bcrypt.hash('Demo@123456', 12);
  await prisma.user.upsert({
    where: { email: 'customer@wemove.local' },
    update: {},
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
    update: {},
    create: {
      email: 'dealer@wemove.local',
      name: 'Demo Dealer Buyer',
      passwordHash: hashCustomer,
      ageConfirmed: true,
      status: 'ACTIVE',
    },
  });
  console.log(
    '[demo] customer@wemove.local / dealer@wemove.local (pwd Demo@123456)',
  );
}

async function seedCatalog() {
  const cats: Array<{ code: string; slug: string; name: string }> = [
    { code: 'BOWLING', slug: 'kids-bowling', name: 'Kids Bowling' },
    {
      code: 'BALANCE',
      slug: 'balance-coordination',
      name: 'Balance & Coordination',
    },
    {
      code: 'OUTDOOR',
      slug: 'outdoor-throw-games',
      name: 'Outdoor Throw Games',
    },
  ];
  const catIds = new Map<string, string>();
  for (const c of cats) {
    const row = await prisma.productCategory.upsert({
      where: { code: c.code },
      update: { slug: c.slug, name: c.name, active: true },
      create: { code: c.code, slug: c.slug, name: c.name },
    });
    catIds.set(c.code, row.id);
  }

  const products: Array<{
    slug: string;
    name: string;
    category: string;
    ageGuidance: string;
    variants: Array<{
      sku: string;
      name: string;
      msrp: number; // 分
      sale: number;
      b2b: number;
      stock: number;
    }>;
  }> = [
    {
      slug: 'strike-kids-bowling-set-6-pin',
      name: 'Strike! Kids Bowling Set — 6 Pins',
      category: 'BOWLING',
      ageGuidance:
        'Recommended for ages 3+. Adult assembly and supervision required.',
      variants: [
        {
          sku: 'WM-BOWL-06-A',
          name: '6-Pin Set / Red',
          msrp: 3999,
          sale: 2999,
          b2b: 1899,
          stock: 120,
        },
        {
          sku: 'WM-BOWL-06-B',
          name: '6-Pin Set / Blue',
          msrp: 3999,
          sale: 2999,
          b2b: 1899,
          stock: 90,
        },
      ],
    },
    {
      slug: 'balance-board-wooden-arc',
      name: 'Wooden Balance Board — Arc',
      category: 'BALANCE',
      ageGuidance:
        'Recommended for ages 3+. Use on a level surface with adult supervision.',
      variants: [
        {
          sku: 'WM-BAL-ARC-01',
          name: 'Arc Board / Natural',
          msrp: 2499,
          sale: 1999,
          b2b: 1250,
          stock: 200,
        },
      ],
    },
    {
      slug: 'ring-toss-outdoor-game-set',
      name: 'Ring Toss Outdoor Game Set',
      category: 'OUTDOOR',
      ageGuidance:
        'Recommended for ages 4+. Adult supervision required during play.',
      variants: [
        {
          sku: 'WM-TOSS-RING-01',
          name: 'Classic Ring Toss',
          msrp: 1899,
          sale: 1499,
          b2b: 899,
          stock: 300,
        },
      ],
    },
  ];

  const goldTier = await prisma.dealerTier.upsert({
    where: { code: 'gold' },
    update: { name: 'Gold' },
    create: { code: 'gold', name: 'Gold', sortOrder: 2 },
  });

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        categoryId: catIds.get(p.category),
        ageGuidance: p.ageGuidance,
        status: 'ACTIVE',
      },
      create: {
        slug: p.slug,
        name: p.name,
        summary: `Demo ${p.name}`,
        ageGuidance: p.ageGuidance,
        categoryId: catIds.get(p.category),
        status: 'ACTIVE',
      },
    });

    for (const v of p.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          msrpCents: v.msrp,
          salePriceCents: v.sale,
          b2bDefaultPriceCents: v.b2b,
          status: true,
          productId: product.id,
        },
        create: {
          sku: v.sku,
          name: v.name,
          productId: product.id,
          msrpCents: v.msrp,
          salePriceCents: v.sale,
          b2bDefaultPriceCents: v.b2b,
        },
      });
      await prisma.stock.upsert({
        where: { variantId: variant.id },
        update: { available: v.stock },
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
  console.log(
    '[catalog] categories/products seeded (3/3) with gold tier rules',
  );
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
  await seedDemoCompany();
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

import { expect as baseExpect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";

const expect = baseExpect.configure({ timeout: 15000 });
test.use({ viewport: { width: 1440, height: 1000 } });

test("customer and dealer entry forms keep Chinese across unprefixed links and switch back to English", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("wm_consent", "essential"),
  );
  await page.goto("/zh/customer/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(
    page.getByRole("heading", { name: "欢迎回来", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("邮箱", { exact: true })).toBeVisible();
  await expect(page.getByLabel("密码", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "创建账号", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.getByLabel("姓名", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "我确认已年满 18 周岁。", exact: true }),
  ).toBeVisible();
  await page.goto("/dealer/apply");
  await expect(
    page.getByRole("heading", { name: "成为 WEMOVE 经销商", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("联系人姓名", { exact: false })).toBeVisible();
  await page.goto("/dealer/login");
  await expect(
    page.getByRole("heading", { name: "欢迎回来", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "语言", exact: true })
    .selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/Sign in/);
});

test("isolated customer and dealer sessions localize account, catalog, company, terms and procurement screens", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const prisma = new PrismaClient();
  const key = randomUUID().slice(0, 8);
  const email = `browser-locale-${key}@example.test`;
  const password = `Locale-${key}-123!`;
  const sku = `LOCALE-BROWSER-${key}`.toUpperCase();
  const productName = `Locale training equipment ${key}`;
  const chineseName = `双语运动器材 ${key}`;
  let userId = "",
    companyId = "",
    productId = "";
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(password, 12),
        name: `双语演示采购员 ${key}`,
        status: "ACTIVE",
        ageConfirmed: true,
      },
    });
    userId = user.id;
    const product = await prisma.product.create({
      data: {
        name: productName,
        slug: `locale-browser-${key}`,
        summary: "English training equipment summary.",
        status: "ACTIVE",
        markets: ["US"],
        specifications: {
          translations: {
            zh: {
              status: "PUBLISHED",
              name: chineseName,
              summary: "已发布的中文商品介绍。",
              variants: { [sku]: { name: "蓝色款" } },
            },
          },
        },
        variants: {
          create: {
            sku,
            name: "Blue",
            status: true,
            msrpCents: 2000,
            b2bDefaultPriceCents: 1000,
            stock: { create: { available: 20 } },
          },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    const company = await prisma.dealerCompany.create({
      data: {
        companyName: `双语企业 ${key}`,
        legalRegNo: `LOCALE-${key}`,
        country: "US",
        status: "APPROVED",
        catalogPolicy: { productIds: [productId], markets: ["US"] },
        purchaseSettings: {
          currency: "USD",
          moq: 2,
          multiple: 2,
          caseSize: 2,
          leadTimeDays: 3,
          paymentMethods: ["BANK_TRANSFER"],
        },
      },
    });
    companyId = company.id;
    await prisma.accountFavorite.create({ data: { userId, productId } });
    await prisma.cart.create({
      data: {
        userId,
        items: {
          create: {
            variantId: product.variants[0].id,
            quantity: 1,
            unitPriceCents: 2000,
          },
        },
      },
    });

    await page.addInitScript(() =>
      localStorage.setItem("wm_consent", "essential"),
    );
    await page.goto("/zh/customer/login");
    await expect(page.getByLabel("邮箱", { exact: true })).toBeEnabled();
    await page.getByLabel("邮箱", { exact: true }).fill(email);
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "我的账户", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "个人资料与订阅", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "安全与设备", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "地址簿", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: chineseName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "邮件语言", exact: true }),
    ).toHaveValue("en");
    await expect(
      page.getByRole("combobox", { name: "款式", exact: true }),
    ).toContainText("蓝色款");
    await page
      .getByRole("combobox", { name: "语言", exact: true })
      .selectOption("en");
    await expect(
      page.getByRole("heading", { name: "My Account", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: productName, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("zh");

    await prisma.dealerMember.create({
      data: { companyId, userId, role: "OWNER" },
    });
    await page.goto("/dealer/login");
    await expect(page.getByLabel("邮箱", { exact: true })).toBeEnabled();
    await page.getByLabel("邮箱", { exact: true }).fill(email);
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "WEMOVE 经销商门户条款", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "授权目录与保密信息", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("点击同意即表示您确认有权访问本企业的经销商账户", {
        exact: false,
      }),
    ).toBeVisible();
    const before = await prisma.dealerMember.findUniqueOrThrow({
      where: { companyId_userId: { companyId, userId } },
    });
    expect(before.termsAcceptedAt).toBeNull();
    await page.getByRole("checkbox", { name: /我已阅读版本/ }).check();
    await page.getByRole("button", { name: "同意并继续", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "您的批发价格", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: chineseName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: `选择 ${sku}`, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("蓝色款", { exact: true })).toBeVisible();
    await page
      .getByRole("combobox", { name: "语言", exact: true })
      .selectOption("en");
    await expect(
      page.getByRole("heading", { name: "Your wholesale prices", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: productName, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("zh");
    for (const [route, heading] of [
      ["/dealer/dashboard", company.companyName],
      ["/dealer/company", "企业、团队与地址"],
      ["/dealer/security", "账户安全"],
      ["/dealer/downloads", "企业下载中心"],
      ["/dealer/procurement", "报价与采购订单"],
      ["/dealer/quick-order", "快速下单"],
      ["/dealer/application", "查询经销商申请"],
    ]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", "zh");
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: "语言", exact: true }),
      ).toHaveValue("zh");
    }
    await page.goto("/dealer/company");
    await expect(page.locator('select[name="role"]').first()).toHaveValue(
      "OWNER",
    );
    await expect(page.locator('select[name="role"]').first()).toContainText(
      "采购员",
    );
    await expect(page.locator('select[name="kind"]')).toHaveValue("BOTH");
    await expect(page.locator('select[name="kind"]')).toContainText(
      "收货及账单地址",
    );
    await page.goto("/dealer/quick-order");
    await page.getByLabel("SKU 与数量", { exact: true }).fill(`${sku},1`);
    await page.getByRole("button", { name: "验证订单", exact: true }).click();
    const validationRow = page.getByRole("row").filter({ hasText: sku });
    await expect(validationRow).toContainText(
      "最小起订量 2；订购倍数 2；每箱数量 2。",
    );
    await page.getByLabel("SKU 与数量", { exact: true }).fill(`${sku},2`);
    await page.getByRole("button", { name: "验证订单", exact: true }).click();
    await expect(validationRow).toContainText(chineseName);
    await expect(validationRow).toContainText("交期 3 天");
    await expect(validationRow).not.toContainText(productName);
    const after = await prisma.dealerMember.findUniqueOrThrow({
      where: { companyId_userId: { companyId, userId } },
    });
    expect(after.termsAcceptedAt).not.toBeNull();
    expect(after.termsVersion).toBe("dealer-terms-2026-09");
  } finally {
    const ids = [userId, companyId, productId].filter(Boolean);
    if (ids.length) {
      await prisma.notificationOutbox.deleteMany({
        where: { OR: ids.map((id) => ({ dedupeKey: { contains: id } })) },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorCustomerId: userId || "no-fixture" },
            { entityId: { in: ids } },
          ],
        },
      });
    }
    if (companyId)
      await prisma.dealerCompany.delete({ where: { id: companyId } });
    if (userId) {
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: userId },
      });
      await prisma.user.delete({ where: { id: userId } });
    }
    if (productId) await prisma.product.delete({ where: { id: productId } });
    await prisma.$disconnect();
  }
});

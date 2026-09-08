import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });
const language = (page: Page, label: "Language" | "语言") =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });

test("about content switches both directions and keeps language on unprefixed public links", async ({
  page,
}) => {
  await page.goto("/en/about?market=US");
  await expect(page.locator("h1")).toHaveText("About WEMOVE");
  await language(page, "Language").selectOption("zh");
  await expect(page).toHaveURL(/\/zh\/about\?market=US/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.locator("h1")).toHaveText("关于 WEMOVE");
  await expect(
    page.getByRole("heading", { name: "木材、运动与开放式学习" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "Wood, movement and open-ended learning",
  );
  await page.goto("/quality-safety?market=US");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.locator("h1")).toHaveText("品质与安全");
  await language(page, "语言").selectOption("en");
  await expect(page.locator("h1")).toHaveText("Quality and safety");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

for (const [path, english, chinese] of [
  ["privacy", "Privacy information", "隐私信息"],
  ["terms", "Website terms", "网站使用条款"],
  ["contact", "Contact Us", "联系我们"],
  ["dealers", "Find a dealer", "查找经销商"],
  ["support", "Support & Downloads", "支持与下载"],
  ["support/downloads", "Downloads", "资料下载"],
  ["play-learn", "Play & Learn", "玩乐与学习"],
  [
    "content/article-active-family-play",
    "Getting started with a wooden marble run",
    "原木滚珠轨道入门",
  ],
  ["cookies", "Cookie settings", "Cookie 设置"],
  ["newsletter", "Email subscription", "邮件订阅"],
] as const) {
  test(`English and Chinese public page: ${path}`, async ({ page }) => {
    await page.goto(`/en/${path}?market=US`);
    await expect(page.locator("h1")).toHaveText(english);
    await language(page, "Language").selectOption("zh");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
    await expect(page.locator("h1")).toHaveText(chinese);
    await expect(language(page, "语言")).toHaveValue("zh");
    await language(page, "语言").selectOption("en");
    await expect(page.locator("h1")).toHaveText(english);
  });
}

test("FAQ search and article navigation use the requested Chinese content", async ({
  page,
}) => {
  await page.goto("/zh/support/faq?market=US");
  await expect(page.locator("h1")).toHaveText("常见问题");
  await page.getByLabel("搜索", { exact: true }).fill("说明书");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page).not.toHaveURL(/\/en\//);
  await page.getByText("在哪里可以找到商品说明书？", { exact: true }).click();
  await expect(page.locator("details[open]")).toContainText(
    "请打开商品详情页或浏览下载中心",
  );
  await page.goto("/zh/play-learn?market=US");
  await page
    .getByRole("link", { name: "原木滚珠轨道入门", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(
    page.getByRole("heading", { name: "先搭建稳固底座" }),
  ).toBeVisible();
});

test("password and verification forms localize validation without sending an email", async ({
  page,
}) => {
  await page.goto("/zh/forgot-password");
  await expect(page.locator("h1")).toHaveText("重置密码");
  await expect(
    page.getByRole("button", { name: "发送重置说明", exact: true }),
  ).toBeVisible();
  await page.goto("/zh/verify-email");
  await expect(page.locator("h1")).toHaveText("验证邮箱");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "此验证链接不完整，请重新申请验证邮件。",
  );
  await page.goto("/zh/reset-password?token=invalid-demo-token");
  await page.getByLabel("新密码", { exact: true }).fill("DemoTest123");
  await page.getByLabel("确认新密码", { exact: true }).fill("DemoTest124");
  await page.getByRole("button", { name: "保存新密码", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "两次输入的密码不一致。",
  );
  await language(page, "语言").selectOption("en");
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
});

test("guest cart switches live product names without changing quantities or stored prices", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "/api/v1/products/standard-50?locale=en&market=US",
  );
  expect(response.ok()).toBe(true);
  const { data: product } = await response.json();
  const variant = product.variants.find(
    (item: { price?: { priceCents: number } }) => item.price,
  );
  const saved = [
    {
      variantId: variant.id,
      sku: variant.sku,
      name: product.name,
      quantity: 2,
      unitPriceCents: variant.price.priceCents,
    },
  ];
  await page.addInitScript((items) => {
    if (!localStorage.getItem("wm-guest-cart"))
      localStorage.setItem("wm-guest-cart", JSON.stringify(items));
  }, saved);
  await page.goto("/en/cart?market=US");
  await expect(page.locator("main")).toContainText("WEMOVE Standard 50", {
    timeout: 20000,
  });
  await language(page, "Language").selectOption("zh");
  await expect(page.locator("h1")).toHaveText("购物车与结算");
  await expect(page.locator("main")).toContainText("50块标准款套装");
  await expect(page.locator("main")).not.toContainText("WEMOVE Standard 50");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wm-guest-cart") ?? "[]"),
  );
  expect(stored[0].quantity).toBe(2);
  expect(stored[0].unitPriceCents).toBe(saved[0].unitPriceCents);
  await language(page, "语言").selectOption("en");
  await expect(page.locator("main")).toContainText("WEMOVE Standard 50");
});

test("comparison and missing pages keep the selected Chinese UI", async ({
  page,
}) => {
  await page.goto("/zh/compare?market=US&ids=standard-50,cugolino-basic");
  await expect(page.locator("h1")).toHaveText("产品比较");
  await expect(
    page.getByRole("columnheader", { name: "属性", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "适龄建议", exact: false }),
  ).toBeVisible();
  await page.goto("/zh/no-such-public-demo-page");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.locator("h1")).toHaveText("找不到页面");
  await expect(language(page, "语言").first()).toBeVisible();
});

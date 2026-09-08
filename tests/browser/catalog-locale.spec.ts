import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });

test("language switch keeps catalog filters and Chinese product details", async ({
  page,
}) => {
  await page.goto(
    "/en/products?market=US&category=marble-run-blocks&sort=price-asc",
  );
  await page
    .getByLabel("Language", { exact: true })
    .filter({ visible: true })
    .selectOption("zh");
  await expect(page).toHaveURL(/\/zh\/products\?/);
  const switched = new URL(page.url());
  expect(switched.searchParams.get("category")).toBe("marble-run-blocks");
  expect(switched.searchParams.get("sort")).toBe("price-asc");
  expect(switched.searchParams.get("market")).toBe("US");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.locator("h1")).toContainText("积木玩具");
  await page.getByLabel("搜索产品", { exact: true }).fill("标准");
  await page.getByRole("button", { name: "查看结果", exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/products\?/);
  const product = page
    .locator('main a[href*="/zh/products/standard-50"]')
    .first();
  await expect(product).toBeVisible();
  await product.click();
  await expect(page).toHaveURL(/\/zh\/products\/standard-50\?market=US/);
  await expect(page.locator("h1")).toContainText("50块标准款套装");
  await expect(
    page.getByRole("heading", { name: "产品规格", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "安装、玩法、保养与安全", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "常见问题", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "款式", exact: true }),
  ).toContainText("标准50块套装");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/zh\/products\//,
  );
  await page
    .locator("main nav")
    .getByRole("link", { name: "产品", exact: true })
    .click();
  await expect(page).toHaveURL(/\/zh\/products\?market=US/);
  await expect(page.locator("h1")).toHaveText("积木玩具");
  await page
    .getByLabel("语言", { exact: true })
    .filter({ visible: true })
    .selectOption("en");
  await expect(page).toHaveURL(/\/en\/products\?market=US/);
  await expect(page.locator("h1")).toHaveText("WEMOVE wooden marble runs");
});

test("Chinese homepage catalog links retain the selected language and market", async ({
  page,
}) => {
  await page.goto("/zh?market=US");
  const heroCatalogLink = page
    .getByRole("navigation", { name: "选购与服务" })
    .getByRole("link", { name: "完整产品中心", exact: true });
  await expect(heroCatalogLink).toBeVisible();
  await heroCatalogLink.click();
  await expect(page).toHaveURL(/\/zh\/products\?market=US/);
  await expect(page.getByLabel("搜索产品", { exact: true })).toBeVisible();
});

for (const product of [
  { slug: "standard-50", name: "50块标准款套装" },
  { slug: "large-pendulum-set", name: "大摆锤套" },
  { slug: "magnetic-cannon", name: "电磁炮" },
]) {
  test(`Chinese demo product is published: ${product.slug}`, async ({
    page,
    request,
  }) => {
    const response = await request.get(
      `/api/v1/products/${product.slug}?locale=zh&market=US`,
    );
    expect(response.ok()).toBe(true);
    const { data } = await response.json();
    expect(data.locale).toBe("zh");
    expect(data.publishedLanguages).toContain("zh");
    expect(data.name).toContain(product.name);
    await page.goto(`/zh/products/${product.slug}?market=US`);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
    await expect(page.locator("h1")).toContainText(product.name);
    await expect(
      page.getByRole("heading", { name: "产品规格", exact: true }),
    ).toBeVisible();
  });
}

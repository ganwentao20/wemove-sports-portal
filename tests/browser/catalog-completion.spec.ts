import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { generate } from "otplib";

test("category editor publishes metadata, typed product links and useful empty/dealer catalog states", async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(90000);
  const prisma = new PrismaClient(),
    key = randomUUID().slice(0, 8),
    password = "Browser-" + key + "-123!",
    email = "category-browser-" + key + "@example.test";
  const role = await prisma.role.findUniqueOrThrow({
      where: { code: "SUPER_ADMIN" },
    }),
    staff = await prisma.staff.create({
      data: {
        name: "Category browser tester",
        email,
        passwordHash: await hash(password, 12),
        roles: { create: { roleId: role.id } },
      },
    });
  const accessory = await prisma.product.create({
      data: {
        name: "Accessory " + key,
        slug: "accessory-browser-" + key,
        status: "ACTIVE",
        markets: ["US"],
      },
    }),
    replacement = await prisma.product.create({
      data: {
        name: "Replacement " + key,
        slug: "replacement-browser-" + key,
        status: "ACTIVE",
        markets: ["US"],
      },
    });
  const product = await prisma.product.create({
    data: {
      name: "Category product " + key,
      slug: "category-product-" + key,
      status: "ACTIVE",
      markets: ["US"],
      associations: [
        { type: "ACCESSORY", slug: accessory.slug },
        { type: "REPLACEMENT", slug: replacement.slug },
      ],
      variants: {
        create: {
          sku: "CAT-BROWSER-" + key,
          msrpCents: 1200,
          stock: { create: { available: 4 } },
        },
      },
    },
  });
  const categorySlug = "browser-category-" + key;
  let categoryId = "";
  try {
    const first = await request.post("/api/session/staff/login", {
      headers: { "x-wemove-csrf": "1" },
      data: { email, password },
    });
    expect(first.ok()).toBe(true);
    const challenge = (await first.json()).data,
      secret = challenge.secret as string;
    const verified = await request.post("/api/session/staff/login", {
      headers: { "x-wemove-csrf": "1" },
      data: {
        challengeToken: challenge.challengeToken,
        code: await generate({ secret }),
      },
    });
    expect(verified.ok()).toBe(true);
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto("/admin/products");
    await page
      .getByLabel("Current MFA code", { exact: true })
      .fill(await generate({ secret }));
    const editor = page
      .getByRole("heading", { name: "Category pages", exact: true })
      .locator("..");
    await editor
      .getByLabel("Code", { exact: true })
      .fill("BROWSER_" + key.toUpperCase());
    await editor
      .getByLabel("Name", { exact: true })
      .fill("Category heading " + key);
    await editor.getByLabel("URL slug", { exact: true }).fill(categorySlug);
    await editor
      .getByLabel("Description", { exact: true })
      .fill("Independent category introduction");
    await editor
      .getByLabel("Cover image URL", { exact: true })
      .fill("/images/wemove-active-play-hero.png");
    await editor
      .getByLabel("Cover image description", { exact: true })
      .fill("Category cover " + key);
    await editor
      .locator("summary")
      .filter({ hasText: "Search and social metadata" })
      .click();
    await editor
      .getByLabel("Search title", { exact: true })
      .fill("Independent category SEO " + key);
    await editor
      .getByLabel("Search description", { exact: true })
      .fill("Independent category search summary");
    await editor
      .getByRole("button", { name: "Create category", exact: true })
      .click();
    await expect(editor.getByRole("status")).toContainText("Category saved", {
      timeout: 15000,
    });
    const category = await prisma.productCategory.findUniqueOrThrow({
      where: { slug: categorySlug },
    });
    categoryId = category.id;
    expect(category.seo).toMatchObject({
      title: "Independent category SEO " + key,
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { categoryId },
    });
    await page.goto("/en/products?market=US&category=" + categorySlug);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      category.name,
    );
    await expect(page).toHaveTitle(
      new RegExp("Independent category SEO " + key),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Independent category search summary",
    );
    await expect(
      page.getByRole("img", { name: "Category cover " + key }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp("category=" + categorySlug + "&market=US"),
    );
    await page.goto("/en/products/" + product.slug + "?market=US");
    await expect(
      page
        .locator('[data-association-type="accessories"]')
        .getByRole("link", { name: accessory.name, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-association-type="replacements"]')
        .getByRole("link", { name: replacement.name, exact: true }),
    ).toBeVisible();
    await page.goto("/en/products?market=US&search=no-match-" + key);
    await expect(
      page.getByRole("heading", { name: "No exact match yet" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Browse categories" })
        .getByRole("link", { name: category.name, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-module-id="empty-catalog-recommendations"] a')
        .first(),
    ).toBeVisible();
    // This checks the session-aware prompt only; authenticated procurement is covered by dealer-journey.
    await page.context().addCookies([
      {
        name: "wm_dealer_session",
        value: "session-indicator-for-ui-test",
        url: baseURL!,
        httpOnly: true,
      },
    ]);
    await page.goto("/en/products?market=US&category=" + categorySlug);
    await expect(
      page.getByText("Check dealer price and minimum order", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Authorized dealer catalog",
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      "/en/dealer/catalog?productId=" + product.id + "&market=US",
    );
  } finally {
    await prisma.product.deleteMany({
      where: { id: { in: [product.id, accessory.id, replacement.id] } },
    });
    if (categoryId)
      await prisma.productCategory.delete({ where: { id: categoryId } });
    else
      await prisma.productCategory.deleteMany({
        where: { slug: categorySlug },
      });
    await prisma.authenticationSession.deleteMany({
      where: { ownerId: staff.id },
    });
    await prisma.staffLoginChallenge.deleteMany({
      where: { staffId: staff.id },
    });
    await prisma.auditLog.deleteMany({ where: { actorStaffId: staff.id } });
    await prisma.staff.delete({ where: { id: staff.id } });
    await prisma.$disconnect();
  }
});

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { generate } from "otplib";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";

const widths = [360, 390, 768, 1024, 1440, 1920];
const publicRoutes = [
  "/",
  "/products",
  "/search?q=bowling",
  "/content/article-active-family-play",
  "/support/faq",
  "/dealers",
  "/customer/register",
  "/login",
];
for (const width of widths)
  test(`public templates fit ${width}px and retain usable navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of publicRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBeLessThan(400);
      await expect(page.locator("h1").first()).toBeVisible();
      const size = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(size.scroll, `${route} horizontal overflow`).toBeLessThanOrEqual(
        size.client + 1,
      );
    }
    if (width === 390 || width === 1440) {
      await page.goto("/");
      await page.screenshot({
        path: `test-results/home-${width}.png`,
        fullPage: true,
      });
    }
  });
for (const route of [
  "/",
  "/products",
  "/search?q=bowling",
  "/customer/register",
  "/login",
  "/support/faq",
  "/forgot-password",
  "/reset-password?token=accessibility-check-token",
  "/verify-email?token=accessibility-check-token",
])
  test(`WCAG critical and serious checks ${route}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await page.locator("h1").first().waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const violations = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );
    expect(
      violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });
test("language navigation, live search and consent controls work", async ({
  page,
}) => {
  await page.goto("/zh");
  await expect(page.locator("h1")).toContainText("从运动开始玩乐");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await page.goto("/en/search");
  await page
    .getByRole("textbox", {
      name: "Search products, articles, FAQs and downloads",
    })
    .fill("bowling");
  await expect(
    page.getByRole("list", { name: "Search suggestions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("main")).toContainText("results");
  await page.goto("/en/cookies");
  await page.getByLabel("Allow optional analytics").check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  expect(await page.evaluate(() => localStorage.getItem("wm_consent"))).toBe(
    "analytics",
  );
  await page.getByLabel("Allow optional analytics").uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  expect(await page.evaluate(() => localStorage.getItem("wm_consent"))).toBe(
    "essential",
  );
});
test("customer login reaches real profile, address and order interfaces", async ({
  page,
}) => {
  await page.goto("/customer/login");
  await page.getByLabel("Email", { exact: true }).fill("customer@wemove.local");
  await page.getByLabel("Password", { exact: true }).fill("Demo1234");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/customer\/account/, { timeout: 15000 });
  await expect(page.locator("main")).toContainText("Profile");
  await expect(page.locator("main")).toContainText("Address book");
  await expect(page.locator("main")).toContainText("Security");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "wm_customer_session")?.httpOnly).toBe(
    true,
  );
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});
test("staff password is only a challenge and MFA unlocks the operational UI", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const prisma = new PrismaClient();
  const email = `browser-${randomUUID()}@example.test`,
    password = `Browser-${randomUUID()}!`;
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: "SUPER_ADMIN" },
  });
  const staff = await prisma.staff.create({
    data: {
      email,
      passwordHash: await hash(password, 12),
      name: "Browser verification",
      roles: { create: { roleId: role.id } },
    },
  });
  try {
    const first = await request.post("/api/session/staff/login", {
      headers: { "x-wemove-csrf": "1" },
      data: { email, password },
    });
    expect(first.ok()).toBe(true);
    const challenge = (await first.json()).data;
    expect(challenge.mfaRequired).toBe(true);
    expect(challenge.accessToken).toBeUndefined();
    const secret = challenge.secret as string;
    expect(secret).toBeTruthy();
    const verified = await request.post("/api/session/staff/login", {
      headers: { "x-wemove-csrf": "1" },
      data: {
        challengeToken: challenge.challengeToken,
        code: await generate({ secret }),
      },
    });
    expect(verified.ok()).toBe(true);
    await page
      .context()
      .addCookies(await request.storageState().then((s) => s.cookies));
    for (const path of [
      "/admin/dashboard",
      "/admin/cms",
      "/admin/roles",
      "/admin/audit",
      "/admin/seo",
      "/admin/reports",
      "/admin/settings",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.getByText("staff only", { exact: true })).toHaveCount(
        0,
      );
    }
    await page.goto("/admin/cms");
    await page.getByRole("button", { name: "New page", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Save content", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/admin-cms.png",
      fullPage: true,
    });

    const contentSlug = "browser-content-" + staff.id;
    await page.getByLabel("Slug", { exact: true }).fill(contentSlug);
    await page
      .getByLabel("Page title", { exact: true })
      .fill("Browser publication check");
    await page.getByRole("button", { name: "+ text", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Body text", exact: true })
      .fill("This content was created and published through the editor.");
    await page
      .getByLabel("MFA code", { exact: true })
      .fill(await generate({ secret }));
    await page
      .getByRole("button", { name: "Save content", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Content saved." }),
    ).toBeVisible({ timeout: 15000 });
    const draft = await request.get("/api/v1/cms/pages/" + contentSlug);
    expect(draft.status()).toBe(404);
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Preview", exact: true }).click();
    const preview = await popupPromise;
    await expect(
      preview.getByText(
        "This content was created and published through the editor.",
      ),
    ).toBeVisible();
    await preview.close();
    await page
      .getByRole("combobox", { name: "Publish state", exact: true })
      .selectOption("PUBLISHED");
    await page
      .getByLabel("MFA code", { exact: true })
      .fill(await generate({ secret }));
    await page
      .getByRole("button", { name: "Save content", exact: true })
      .click();
    await expect
      .poll(async () => {
        const r = await request.get("/api/v1/cms/pages/" + contentSlug);
        return r.status();
      })
      .toBe(200);
    await page
      .getByRole("button", { name: "Version history", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Restore as draft", exact: true })
      .first()
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Version restored as draft." }),
    ).toBeVisible();
    expect(
      (await request.get("/api/v1/cms/pages/" + contentSlug)).status(),
    ).toBe(404);
  } finally {
    const pages = await prisma.cmsPage.findMany({
      where: { slug: "browser-content-" + staff.id },
      select: { id: true },
    });
    await prisma.cmsRevision.deleteMany({
      where: { pageId: { in: pages.map((row) => row.id) } },
    });
    await prisma.cmsPage.deleteMany({
      where: { slug: "browser-content-" + staff.id },
    });
    await prisma.authenticationSession.deleteMany({
      where: { ownerId: staff.id },
    });
    await prisma.staffLoginChallenge.deleteMany({
      where: { staffId: staff.id },
    });
    await prisma.staffRole.deleteMany({ where: { staffId: staff.id } });
    await prisma.auditLog.deleteMany({ where: { actorStaffId: staff.id } });
    await prisma.staff.delete({ where: { id: staff.id } });
    await prisma.$disconnect();
  }
});

import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { generate, generateSecret } from "otplib";
import { DEALER_TERMS_VERSION } from "../../apps/api/src/account/dealer-terms";
import { loginDestination } from "../../apps/web/lib/login-destination";

test("encoded and normalized return paths cannot select another account area", () => {
  for (const next of [
    "/admin/dashboard",
    "/dealer/catalog",
    "/en//admin/dashboard",
    "/en/%2fdealer/catalog",
    "/%2f%2fevil.example",
    "/en/%2561dmin/dashboard",
    "/en/../admin/dashboard",
    "//evil.example",
    "/login",
  ])
    expect(loginDestination({ sessionKind: "customer" }, next)).toBe(
      "/customer/account",
    );
  expect(loginDestination({ sessionKind: "customer" }, "/checkout")).toBe(
    "/checkout",
  );
  expect(
    loginDestination(
      { sessionKind: "dealer", user: { dealerTermsRequired: true } },
      "/dealer/catalog",
    ),
  ).toBe("/dealer/terms");
  expect(
    loginDestination(
      { sessionKind: "dealer", user: { mfaRequired: true, mfaEnabled: false } },
      "/dealer/catalog",
    ),
  ).toBe("/dealer/security");
});

const sessionCookies = [
  "wm_customer_session",
  "wm_dealer_session",
  "wm_staff_session",
];

async function submitCredentials(page: Page, email: string, password: string) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/session/login" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return responsePromise;
}

async function expectOnlySession(page: Page, name: string) {
  const cookies = (await page.context().cookies()).filter((cookie) =>
    sessionCookies.includes(cookie.name),
  );
  expect(cookies.map((cookie) => cookie.name)).toEqual([name]);
  expect(cookies[0]).toMatchObject({ httpOnly: true, secure: true });
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
}

test.describe("unified account sign-in", () => {
  const prisma = new PrismaClient();
  const key = randomUUID();
  const password = `Unified-${key}-123!`;
  const customerEmail = `unified-customer-${key}@example.test`;
  const dealerEmail = `unified-dealer-${key}@example.test`;
  const staffEmail = `unified-staff-${key}@example.test`;
  const secret = generateSecret();
  let customerId = "";
  let dealerId = "";
  let staffId = "";
  let companyId = "";

  test.beforeAll(async () => {
    const passwordHash = await hash(password, 12);
    const customer = await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash,
        name: "Unified consumer verification",
        ageConfirmed: true,
        status: "ACTIVE",
      },
    });
    customerId = customer.id;
    const dealer = await prisma.user.create({
      data: {
        email: dealerEmail,
        passwordHash,
        name: "Unified dealer verification",
        ageConfirmed: true,
        status: "ACTIVE",
      },
    });
    dealerId = dealer.id;
    const company = await prisma.dealerCompany.create({
      data: {
        companyName: `Unified browser company ${key}`,
        legalRegNo: `UNIFIED-${key}`,
        country: "US",
        status: "APPROVED",
        members: {
          create: {
            userId: dealerId,
            role: "OWNER",
            termsVersion: DEALER_TERMS_VERSION,
            termsAcceptedAt: new Date(),
          },
        },
      },
    });
    companyId = company.id;
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: "SUPER_ADMIN" },
    });
    const staff = await prisma.staff.create({
      data: {
        email: staffEmail,
        passwordHash,
        name: "Unified staff verification",
        mfaEnabled: true,
        mfaSecret: secret,
        roles: { create: { roleId: role.id } },
      },
    });
    staffId = staff.id;
  });

  test.afterAll(async () => {
    try {
      const userIds = [customerId, dealerId].filter(Boolean);
      await prisma.authenticationSession.deleteMany({
        where: { ownerId: { in: [...userIds, staffId].filter(Boolean) } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorCustomerId: { in: userIds } },
            { actorStaffId: staffId || "no-unified-fixture" },
          ],
        },
      });
      if (companyId)
        await prisma.dealerCompany.delete({ where: { id: companyId } });
      if (staffId) {
        await prisma.staffLoginChallenge.deleteMany({ where: { staffId } });
        await prisma.staff.delete({ where: { id: staffId } });
      }
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("wm_consent", "essential"),
    );
  });

  test("one form routes all three roles, rejects foreign next paths and clears previous identity sessions", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/login?next=%2Fadmin%2Fdashboard");
    const customerResponse = await submitCredentials(
      page,
      customerEmail,
      password,
    );
    expect(customerResponse.ok()).toBe(true);
    const customerData = (await customerResponse.json()).data;
    expect(customerData.sessionKind).toBe("customer");
    expect(customerData.accessToken).toBeUndefined();
    await expect(page).toHaveURL(/\/customer\/account$/, { timeout: 15_000 });
    await expect(page.locator("main")).toContainText("Address book");
    await expectOnlySession(page, "wm_customer_session");
    expect(
      (await page.request.get("/api/secure/staff/admin/me")).status(),
    ).toBe(401);

    await page.goto("/login?next=%2Fcustomer%2Faccount");
    const dealerResponse = await submitCredentials(page, dealerEmail, password);
    expect(dealerResponse.ok()).toBe(true);
    const dealerData = (await dealerResponse.json()).data;
    expect(dealerData.sessionKind).toBe("dealer");
    expect(dealerData.accessToken).toBeUndefined();
    await expect(page).toHaveURL(/\/dealer\/catalog$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Your wholesale prices", exact: true }),
    ).toBeVisible();
    await expectOnlySession(page, "wm_dealer_session");
    expect(
      (await page.request.get("/api/secure/dealer/dealer/catalog")).status(),
    ).toBe(200);

    await page.goto("/login?next=%2Fdealer%2Fcatalog");
    const challengeResponse = await submitCredentials(
      page,
      staffEmail,
      password,
    );
    expect(challengeResponse.ok()).toBe(true);
    const challenge = (await challengeResponse.json()).data;
    expect(challenge.mfaRequired).toBe(true);
    expect(challenge.challengeToken).toBeTruthy();
    expect(challenge.accessToken).toBeUndefined();
    await expect(page).toHaveURL(/\/login\?/);
    await expect(
      page.getByLabel("Authenticator code", { exact: true }),
    ).toBeVisible();
    expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "wm_staff_session",
      ),
    ).toBe(false);
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(await generate({ secret }));
    const verifiedPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/session/login" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Verify and sign in", exact: true })
      .click();
    const verified = await verifiedPromise;
    expect(verified.ok()).toBe(true);
    const staffData = (await verified.json()).data;
    expect(staffData.sessionKind).toBe("staff");
    expect(staffData.accessToken).toBeUndefined();
    await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Operations dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: "Roles & permissions", exact: true })
        .first(),
    ).toBeVisible();
    await expectOnlySession(page, "wm_staff_session");
    expect(
      (await page.request.get("/api/secure/dealer/dealer/catalog")).status(),
    ).toBe(401);

    await page.goto("/login?next=%2F%2Fexample.invalid%2Fsteal");
    const switchedBack = await submitCredentials(page, customerEmail, password);
    expect(switchedBack.ok()).toBe(true);
    await expect(page).toHaveURL(/\/customer\/account$/, { timeout: 15_000 });
    await expectOnlySession(page, "wm_customer_session");
    expect(
      (await page.request.get("/api/secure/staff/admin/me")).status(),
    ).toBe(401);
  });

  test("an incorrect password stays at the shared form without an authenticated cookie", async ({
    page,
  }) => {
    await page.goto("/login");
    const response = await submitCredentials(page, customerEmail, "Wrong-123!");
    expect(response.status()).toBe(401);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    expect(
      (await page.context().cookies()).filter((cookie) =>
        sessionCookies.includes(cookie.name),
      ),
    ).toEqual([]);
  });

  test("all previous login links redirect to the shared URL and retain the checkout return path", async ({
    page,
  }) => {
    for (const oldPath of [
      "/customer/login",
      "/dealer/login",
      "/admin/login",
    ]) {
      await page.goto(`${oldPath}?next=%2Fcheckout`);
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/login" &&
          url.searchParams.get("next") === "/checkout",
      );
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sign in", exact: true }),
      ).toBeVisible();
    }
  });
});

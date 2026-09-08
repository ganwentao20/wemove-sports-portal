import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

async function createTestMarket(prisma: PrismaClient) {
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const code = `Q${letter}`;
    try {
      await prisma.retailMarket.create({
        data: {
          code,
          label: "Browser verification",
          countries: ["US"],
          currency: "USD",
          retailEnabled: true,
          paymentMode: "DEMO",
          taxBps: 1000,
          shippingCents: 500,
        },
      });
      return code;
    } catch (error) {
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.meta?.target
          : undefined;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(target) &&
        target.length === 1 &&
        target[0] === "code"
      )
        continue;
      throw error;
    }
  }
  throw new Error("No unused two-letter Q market is available for the retail test");
}

test("guest cart merges once, checkout snapshots totals, demo payment issues an authorized PDF", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90000);
  const prisma = new PrismaClient(),
    key = randomUUID().slice(0, 8),
    email = `browser-shop-${key}@example.test`,
    password = `Browser-${key}-123!`,
    market = await createTestMarket(prisma);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hash(password, 12),
      name: "Browser Shopper",
      ageConfirmed: true,
      status: "ACTIVE",
    },
  });
  const product = await prisma.product.create({
    data: {
      name: `Browser play set ${key}`,
      slug: `browser-play-${key}`,
      summary: "A fixture for the complete shopping journey",
      status: "ACTIVE",
      markets: [market],
      variants: {
        create: {
          sku: `BROWSER-${key}`,
          name: "Blue",
          status: true,
          msrpCents: 2500,
          stock: { create: { available: 10 } },
        },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0];
  try {
    await page
      .context()
      .addCookies([{ name: "wm_market", value: market, url: baseURL! }]);
    await page.goto(`/products/${product.slug}?market=${market}`);
    await page
      .getByRole("button", { name: "Essential only", exact: true })
      .click();
    await page.getByRole("button", { name: /Add to cart/ }).click();
    await expect(
      page.getByText(
        "Saved to your guest cart. Sign in at checkout to merge it.",
      ),
    ).toBeVisible();
    await page.goto("/checkout");
    await page
      .getByRole("link", { name: "Sign in to merge it and check out" })
      .click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/login" &&
        url.searchParams.get("next") === "/checkout",
    );
    await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/checkout", {
      timeout: 15000,
    });
    await expect(
      page.getByRole("button", { name: "Review current prices & totals" }),
    ).toBeEnabled({ timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("wm-guest-cart")))
      .toBeNull();
    await page.reload();
    await expect(
      page.getByRole("spinbutton", { name: "Quantity", exact: true }),
    ).toHaveValue("1");
    for (const [label, value] of Object.entries({
      "Shipping recipient": "Browser Shopper",
      "Shipping phone": "12025550123",
      "Shipping country (ISO code)": "US",
      "Shipping state / region": "CA",
      "Shipping city": "Test City",
      "Shipping postal code": "90210",
      "Shipping address line 1": "100 Test Street",
    }))
      await page.getByLabel(label, { exact: true }).fill(value);
    await page
      .getByRole("button", { name: "Review current prices & totals" })
      .click();
    await expect(
      page.getByRole("button", { name: "Place order & continue to payment" }),
    ).toBeEnabled();
    await expect(
      page.getByText("Demo payment: no real money is charged."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Place order & continue to payment" })
      .click();
    await expect(page).toHaveURL(/\/orders\//);
    await page
      .getByRole("button", { name: "Start payment", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Simulate success", exact: true })
      .click();
    await expect(page.getByText(/Payment PAID/)).toBeVisible();
    const order = await prisma.order.findFirstOrThrow({
      where: { userId: user.id },
      include: { items: true },
    });
    expect(order.items[0].quantity).toBe(1);
    expect(order.paymentStatus).toBe("PAID");
    expect(order.totalCents).toBeGreaterThan(2500);
    expect(order.shippingAddress).toMatchObject({ line1: "100 Test Street" });
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download receipt", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const pdf = await readFile((await download.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(
      await prisma.stock.findUnique({ where: { variantId: variant.id } }),
    ).toMatchObject({ available: 9, reserved: 1 });
  } finally {
    const orders = await prisma.order.findMany({
        where: { userId: user.id },
        select: { id: true },
      }),
      ids = orders.map((o) => o.id);
    const payments = await prisma.retailPayment.findMany({
      where: { orderId: { in: ids } },
      select: { id: true },
    });
    await prisma.retailPaymentEvent.deleteMany({
      where: { paymentId: { in: payments.map((p) => p.id) } },
    });
    await prisma.retailPayment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.authenticationSession.deleteMany({
      where: { ownerId: user.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.retailMarket.delete({ where: { code: market } });
    await prisma.$disconnect();
  }
});

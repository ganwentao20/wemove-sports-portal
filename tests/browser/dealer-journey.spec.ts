import { expect as baseExpect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { generate, generateSecret } from "otplib";

const expect = baseExpect.configure({ timeout: 15000 });

test("first dealer sign-in accepts terms, CSV becomes an RFQ and quoted PO, then downloads a protected PDF and requests a refund", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const prisma = new PrismaClient(),
    key = randomUUID().slice(0, 8);
  const api = "http://127.0.0.1:8080/api/v1";
  const password = `Dealer-browser-${key}-123!`,
    secret = generateSecret();
  const email = `browser-dealer-${key}@example.test`,
    staffEmail = `browser-dealer-staff-${key}@example.test`;
  const productIds: string[] = [];
  let userId = "",
    staffId = "",
    companyId = "";
  try {
    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "浏览器采购员",
        ageConfirmed: true,
        status: "ACTIVE",
      },
    });
    userId = user.id;
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: "SUPER_ADMIN" },
    });
    const staff = await prisma.staff.create({
      data: {
        email: staffEmail,
        passwordHash,
        name: "Browser dealer operations",
        mfaEnabled: true,
        mfaSecret: secret,
        roles: { create: { roleId: role.id } },
      },
    });
    staffId = staff.id;
    const product = await prisma.product.create({
      data: {
        name: `Browser dealer equipment ${key}`,
        slug: `browser-dealer-${key}`,
        status: "ACTIVE",
        markets: ["US"],
        variants: {
          create: {
            sku: `DEALER-BROWSER-${key}`.toUpperCase(),
            name: "Blue",
            status: true,
            b2bDefaultPriceCents: 1000,
            stock: { create: { available: 10 } },
          },
        },
      },
      include: { variants: true },
    });
    productIds.push(product.id);
    const variant = product.variants[0];
    const company = await prisma.dealerCompany.create({
      data: {
        companyName: `浏览器体育企业 ${key}`,
        legalRegNo: `BROWSER-DEALER-${key}`,
        country: "US",
        status: "APPROVED",
        catalogPolicy: { productIds: [product.id], markets: ["US"] },
        purchaseSettings: {
          currency: "USD",
          moq: 2,
          multiple: 2,
          caseSize: 2,
          leadTimeDays: 5,
          reserveAt: "SUBMIT",
          paymentMethods: ["BANK_TRANSFER"],
        },
        members: { create: { userId, role: "OWNER" } },
      },
    });
    companyId = company.id;
    const address = await prisma.dealerAddress.create({
      data: {
        companyId,
        label: "已保存的企业地址",
        kind: "BOTH",
        address: {
          recipient: "张采购",
          phone: "12025550123",
          country: "US",
          city: "旧金山",
          addressLine: "一百号体育中心 二层收货处",
          postalCode: "94102",
        },
      },
    });
    await prisma.dealerCompany.update({
      where: { id: companyId },
      data: {
        profile: {
          defaultShippingAddressId: address.id,
          defaultBillingAddressId: address.id,
        },
      },
    });

    const challengeResponse = await request.post(api + "/auth/staff/login", {
      data: { email: staffEmail, password },
    });
    expect(challengeResponse.status()).toBe(200);
    const challenge = (await challengeResponse.json()).data;
    const loginResponse = await request.post(api + "/auth/staff/mfa", {
      data: {
        challengeToken: challenge.challengeToken,
        code: await generate({ secret }),
      },
    });
    expect(loginResponse.status()).toBe(200);
    const staffToken = (await loginResponse.json()).data.accessToken;
    async function adminPost(path: string, data: object) {
      const response = await request.post(api + path, {
        headers: {
          Authorization: "Bearer " + staffToken,
          "x-mfa-code": await generate({ secret }),
        },
        data,
      });
      expect(response.ok(), await response.text()).toBe(true);
      return (await response.json()).data;
    }

    await page.addInitScript(() =>
      localStorage.setItem("wm_consent", "essential"),
    );
    await page.goto("/dealer/login");
    await expect(
      page.getByLabel("Business email", { exact: true }),
    ).toBeEnabled();
    await page.getByLabel("Business email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/dealer/terms");
    await expect(page.getByText("Company:", { exact: false })).toContainText(
      company.companyName,
    );
    await page.getByRole("checkbox", { name: /I have read version/ }).check();
    await page
      .getByRole("button", { name: "Accept and continue", exact: true })
      .click();
    await expect(page).toHaveURL((url) => url.pathname === "/dealer/catalog");
    await expect(
      page.getByRole("checkbox", {
        name: `Select ${variant.sku}`,
        exact: true,
      }),
    ).toBeVisible();
    const membership = await prisma.dealerMember.findUniqueOrThrow({
      where: { companyId_userId: { companyId, userId } },
    });
    expect(membership.termsAcceptedAt).not.toBeNull();
    expect(membership.termsVersion).not.toBeNull();

    await page.goto("/dealer/quick-order");
    const upload = page.getByLabel("Upload SKU CSV");
    await upload.setInputFiles({
      name: "invalid-moq.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`SKU,quantity\n${variant.sku},1\n`),
    });
    await expect(page.getByLabel("SKU and quantity rows")).toHaveValue(
      `SKU,quantity\n${variant.sku},1\n`,
    );
    await page
      .getByRole("button", { name: "Validate order", exact: true })
      .click();
    await expect(
      page.getByText("Resolve the row errors before continuing.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: variant.sku }),
    ).toContainText("MOQ 2; quantity multiple 2; case size 2.");
    await upload.setInputFiles({
      name: "procurement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`SKU,quantity\n${variant.sku},4\n`),
    });
    await expect(page.getByLabel("SKU and quantity rows")).toHaveValue(
      `SKU,quantity\n${variant.sku},4\n`,
    );
    await page
      .getByRole("button", { name: "Validate order", exact: true })
      .click();
    await expect(
      page.getByText(
        "All rows are ready for the next business-document step.",
        { exact: false },
      ),
    ).toBeVisible();
    const title = `Browser replenishment ${key}`;
    await page.getByLabel("Request title", { exact: true }).fill(title);
    await page
      .getByLabel("Request notes", { exact: true })
      .fill("Separate company quote and Chinese shipping snapshot.");
    await page
      .getByRole("button", { name: "Create RFQ draft", exact: true })
      .click();
    await expect(page).toHaveURL(
      (url) => url.pathname === "/dealer/procurement",
    );
    const rfqCard = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await rfqCard
      .getByRole("button", { name: "Submit for quotation", exact: true })
      .click();
    await expect(rfqCard.getByText("SUBMITTED", { exact: true })).toBeVisible();
    const rfq = await prisma.dealerRfq.findFirstOrThrow({
      where: { companyId, title },
    });
    await adminPost("/admin/b2b/rfqs/" + rfq.id + "/quotes", {
      revision: rfq.revision,
      lines: [{ sku: variant.sku, unitPriceCents: 1000 }],
      taxCents: 100,
      shippingCents: 100,
      discountCents: 0,
      validUntil: new Date(Date.now() + 86400_000).toISOString(),
      paymentTerms: "PREPAID",
      deliveryTerms: "Two cartons, five working days",
    });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(rfqCard.getByText("QUOTED", { exact: true })).toBeVisible();
    await rfqCard
      .getByRole("button", {
        name: "Accept quote & create purchase order",
        exact: true,
      })
      .click();
    await expect(
      rfqCard.getByRole("combobox", {
        name: "Saved shipping address",
        exact: true,
      }),
    ).toHaveValue(address.id);
    await expect(
      rfqCard.getByLabel("Street address", { exact: true }),
    ).toHaveValue("一百号体育中心 二层收货处");
    await rfqCard
      .getByLabel("Customer PO number", { exact: true })
      .fill("CUSTOMER-" + key);
    await rfqCard
      .getByRole("button", { name: "Confirm purchase order", exact: true })
      .click();
    await expect
      .poll(async () => prisma.purchaseOrder.count({ where: { companyId } }))
      .toBe(1);
    const order = await prisma.purchaseOrder.findFirstOrThrow({
      where: { companyId },
      include: { items: true },
    });
    const orderCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: order.orderNo, exact: true }),
    });
    await expect(orderCard).toBeVisible();
    expect(order.items[0].quantity).toBe(4);
    expect(order.totalCents).toBe(4200);
    expect(order.shippingAddress).toMatchObject({
      addressLine: "一百号体育中心 二层收货处",
    });
    expect(order.customerPoNumber).toBe("CUSTOMER-" + key);
    expect(
      await prisma.stock.findUnique({ where: { variantId: variant.id } }),
    ).toMatchObject({ available: 6, reserved: 4 });
    await adminPost(
      "/admin/b2b/purchase-orders/" + order.id + "/offline-payment",
      {
        amountCents: order.totalCents,
        providerReference: "BANK-" + key,
        idempotencyKey: randomUUID(),
      },
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      orderCard.locator("p").filter({ hasText: "Customer PO:" }),
    ).toContainText(/·\s*PAID$/);
    const downloadPromise = page.waitForEvent("download");
    await orderCard
      .getByRole("button", { name: "invoice PDF", exact: true })
      .click();
    const download = await downloadPromise;
    const pdf = await readFile((await download.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10000);
    expect(
      (
        await request.get(
          api + "/dealer/purchase-orders/" + order.id + "/documents/invoice",
        )
      ).status(),
    ).toBe(401);

    await orderCard
      .getByRole("link", {
        name: "Returns, refunds & after-sales history",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp("/dealer/purchase-orders/" + order.id + "/after-sales$"),
    );
    const refundForm = page.locator("form").filter({
      has: page.getByRole("heading", {
        name: "Request a refund",
        exact: true,
      }),
    });
    await refundForm.getByLabel("Amount (USD)", { exact: true }).fill("42.00");
    await refundForm.getByLabel(/Cancel the unshipped order/).check();
    await refundForm
      .getByLabel("Reason", { exact: true })
      .fill("Cancel unshipped browser procurement");
    await refundForm
      .getByRole("button", { name: "Submit refund request", exact: true })
      .click();
    await expect(
      page.getByText("Cancel unshipped browser procurement", { exact: true }),
    ).toBeVisible();
    const refund = await prisma.purchaseOrderRefund.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(refund).toMatchObject({
      amountCents: 4200,
      status: "REQUESTED",
      cancelOrder: true,
    });
    expect(
      await prisma.stock.findUnique({ where: { variantId: variant.id } }),
    ).toMatchObject({ available: 6, reserved: 4 });
  } finally {
    const orders = await prisma.purchaseOrder.findMany({
      where: { companyId },
      select: { id: true },
    });
    const rfqs = await prisma.dealerRfq.findMany({
      where: { companyId },
      select: { id: true },
    });
    const entities = [
      userId,
      staffId,
      companyId,
      ...orders.map((row) => row.id),
      ...rfqs.map((row) => row.id),
    ].filter(Boolean);
    if (entities.length) {
      await prisma.notificationOutbox.deleteMany({
        where: { OR: entities.map((id) => ({ dedupeKey: { contains: id } })) },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorCustomerId: userId || "no-fixture" },
            { actorStaffId: staffId || "no-fixture" },
            { entityId: { in: entities } },
          ],
        },
      });
    }
    if (companyId) {
      await prisma.purchaseOrder.deleteMany({ where: { companyId } });
      await prisma.dealerRfq.deleteMany({ where: { companyId } });
      await prisma.dealerCompany.delete({ where: { id: companyId } });
    }
    await prisma.authenticationSession.deleteMany({
      where: { ownerId: { in: [userId, staffId].filter(Boolean) } },
    });
    if (staffId) {
      await prisma.staffLoginChallenge.deleteMany({ where: { staffId } });
      await prisma.staff.delete({ where: { id: staffId } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  }
});

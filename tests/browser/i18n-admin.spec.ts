import { expect, test, type Request } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { generate } from "otplib";

test("administration keeps Chinese across login, MFA, workbenches and language switches", async ({
  page,
}) => {
  test.setTimeout(180000);
  const prisma = new PrismaClient();
  const email = `i18n-admin-${randomUUID()}@example.test`;
  const password = `I18n-${randomUUID()}!`;
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: "SUPER_ADMIN" },
  });
  const staff = await prisma.staff.create({
    data: {
      email,
      passwordHash: await hash(password, 12),
      name: "Language regression",
      roles: { create: { roleId: role.id } },
    },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Headings are server-rendered before the workbenches finish loading. Wait for
  // the actual data before navigating, including Strict Mode's duplicate loads.
  const pending = new Set<Request>();
  const dataFailures: string[] = [];
  const isWorkbenchData = (request: Request) => {
    const path = new URL(request.url()).pathname;
    return path.startsWith("/api/secure/") || path === "/api/v1/site/config";
  };
  page.on("request", (request) => {
    if (isWorkbenchData(request)) pending.add(request);
  });
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => {
    if (isWorkbenchData(request)) {
      pending.delete(request);
      dataFailures.push(
        `${new URL(request.url()).pathname}: ${request.failure()?.errorText}`,
      );
    }
  });
  const dataRoutes: Record<string, string[]> = {
    "/admin/dashboard": ["/admin/me", "/dashboard/stats"],
    "/admin/products": [
      "/admin/catalog/products",
      "/admin/catalog/categories",
      "/admin/commerce/inventory-alerts",
    ],
    "/admin/orders": [
      "/admin/orders",
      "/admin/commerce/customers",
      "/admin/commerce/order-catalog",
    ],
    "/admin/dealers": ["/admin/dealer/applications"],
    "/admin/contacts": ["/contacts", "/admin/me"],
    "/admin/cms": [
      "/admin/cms/pages",
      "/admin/cms/products",
      "/api/v1/site/config",
    ],
    "/admin/media": ["/media", "/media/cleanup-jobs"],
    "/admin/pricing": [
      "/admin/commerce/markets",
      "/admin/commerce/coupons",
      "/admin/pricing-rules",
    ],
    "/admin/users": [
      "/auth/me",
      "/admin/users",
      "/admin/users/privacy-requests",
    ],
    "/admin/roles": ["/auth/me", "/admin/roles", "/admin/permissions"],
    "/admin/audit": ["/auth/me", "/admin/audit"],
    "/admin/seo": ["/admin/seo/audit", "/admin/seo/redirects"],
    "/admin/reports": ["/admin/reports"],
    "/admin/settings": ["/admin/settings", "/admin/notifications"],
    "/admin/notifications": [
      "/admin/notifications/templates",
      "/admin/notifications/groups",
    ],
    "/admin/security": ["/account/sessions"],
  };
  async function loaded<T>(action: () => Promise<T>, paths: string[]) {
    const responses = paths.map((path) => {
      const expected = path.startsWith("/api/")
        ? path
        : `/api/secure/staff${path}`;
      return page
        .waitForResponse(
          (response) => {
            const url = new URL(response.url());
            return (
              response.request().method() === "GET" &&
              (path.includes("?")
                ? url.pathname + url.search
                : url.pathname) === expected
            );
          },
          { timeout: 20000 },
        )
        .then(async (response) => {
          expect(response.status(), `Workbench data ${expected}`).toBe(200);
          expect(
            await response.finished(),
            `Complete response body ${expected}`,
          ).toBeNull();
          const body = await response.json();
          expect(Object.hasOwn(body, "data"), `Data envelope ${expected}`).toBe(
            true,
          );
        });
    });
    const [result] = await Promise.all([action(), Promise.all(responses)]);
    await expect
      .poll(() => pending.size, {
        message: "All workbench data requests complete",
        timeout: 20000,
      })
      .toBe(0);
    return result;
  }
  try {
    await page.goto("/zh/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
    await expect(page).toHaveTitle(/登录/);
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
    await page.getByLabel("邮箱", { exact: true }).fill(email);
    await page
      .getByLabel("密码", { exact: true })
      .fill("Incorrect-test-password!");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "登录", exact: true })
        .getByRole("alert"),
    ).toContainText("邮箱或密码");
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page.getByText("验证器设置密钥", { exact: true }),
    ).toBeVisible();
    const secret = (await page.locator("code").textContent())?.trim();
    expect(secret).toBeTruthy();
    await page
      .getByLabel("验证器动态码", { exact: true })
      .fill(await generate({ secret: secret! }));
    await loaded(
      () =>
        page.getByRole("button", { name: "验证并登录", exact: true }).click(),
      dataRoutes["/admin/dashboard"],
    );
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20000 });
    await expect(
      page.getByRole("heading", { name: "运营工作台", exact: true }),
    ).toBeVisible();

    const routes = [
      ["/admin/dashboard", "运营工作台"],
      ["/admin/products", "商品与 SKU"],
      ["/admin/orders", "订单履约"],
      ["/admin/dealers", "经销商申请"],
      ["/admin/contacts", "联系收件箱"],
      ["/admin/cms", "内容管理"],
      ["/admin/media", "媒体库"],
      ["/admin/pricing", "价格、优惠与市场"],
      ["/admin/users", "用户与员工"],
      ["/admin/roles", "角色与权限"],
      ["/admin/audit", "审计日志"],
      ["/admin/seo", "搜索可见性"],
      ["/admin/reports", "运营报表"],
      ["/admin/settings", "站点设置"],
      ["/admin/notifications", "通知模板"],
      ["/admin/security", "账号安全"],
    ] as const;
    for (const [route, title] of routes) {
      const response = await loaded(() => page.goto(route), dataRoutes[route]);
      expect(response?.status(), route).toBeLessThan(400);
      await expect(page.locator("html"), route).toHaveAttribute("lang", "zh");
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
        route,
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "语言", exact: true })
          .getByRole("combobox"),
      ).toHaveValue("zh");
    }

    await loaded(
      () => page.goto("/admin/cms?locale-check=1"),
      dataRoutes["/admin/cms"],
    );
    await page.getByRole("button", { name: "新建页面", exact: true }).click();
    const kind = page.getByRole("combobox", { name: "内容类型", exact: true });
    await expect(kind.locator('option[value="PAGE"]')).toHaveText("普通页面");
    await expect(kind.locator('option[value="ARTICLE"]')).toHaveText("文章");
    await kind.selectOption("ARTICLE");
    await expect(kind).toHaveValue("ARTICLE");
    const status = page.getByRole("combobox", {
      name: "发布状态",
      exact: true,
    });
    await expect(status.locator('option[value="DRAFT"]')).toHaveText("草稿");
    await expect(status.locator('option[value="PUBLISHED"]')).toHaveText(
      "已发布",
    );
    await page.getByRole("button", { name: "+ 正文", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "正文", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "文字格式", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "保存内容", exact: true }),
    ).toBeVisible();

    await loaded(
      () =>
        page
          .getByRole("navigation", { name: "语言", exact: true })
          .getByRole("combobox")
          .selectOption("en"),
      dataRoutes["/admin/cms"],
    );
    await expect(page).toHaveURL(/\/en\/admin\/cms\?locale-check=1$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: "Content studio", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New page", exact: true }),
    ).toBeVisible();
    await loaded(
      () =>
        page
          .getByRole("navigation", { name: "Language", exact: true })
          .getByRole("combobox")
          .selectOption("zh"),
      dataRoutes["/admin/cms"],
    );
    await expect(page).toHaveURL(/\/zh\/admin\/cms\?locale-check=1$/);
    await expect(
      page.getByRole("heading", { name: "内容管理", exact: true }),
    ).toBeVisible();
    await loaded(
      () => page.goto("/admin/dealers"),
      dataRoutes["/admin/dealers"],
    );
    const reviewStatus = page.getByRole("combobox", {
      name: "状态",
      exact: true,
    });
    await expect(
      reviewStatus.locator('option[value="UNDER_REVIEW"]'),
    ).toHaveText("审核中");
    await loaded(
      () => reviewStatus.selectOption("MORE_INFO_REQUIRED"),
      ["/admin/dealer/applications?status=MORE_INFO_REQUIRED"],
    );
    await expect(reviewStatus).toHaveValue("MORE_INFO_REQUIRED");
    expect(dataFailures).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: "test-results/admin-chinese-locale.png",
      fullPage: true,
    });
  } finally {
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

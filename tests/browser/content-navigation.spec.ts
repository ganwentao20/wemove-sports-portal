import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

test("original home modules have usable calls to action and respect reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en?market=US");
  const modules = page.locator("[data-module-id]");
  await expect(modules).toHaveCount(7);
  const first = modules.first();
  await expect(first.getByRole("img")).toBeVisible();
  const callToAction = first.getByRole("link", {
    name: "Explore now",
    exact: true,
  });
  await expect(callToAction).toBeVisible();
  await callToAction.focus();
  await expect(callToAction).toBeFocused();
  await callToAction.hover();
  expect(
    await callToAction.evaluate(
      (element) => getComputedStyle(element).transform,
    ),
  ).toBe("none");
  await callToAction.press("Enter");
  await expect(page).toHaveURL(/\/en\/workshop\?market=US/);
  await expect(page.locator("main")).toBeVisible();
});

test("scheduled hero, manual articles, two-level drawer and independent product SEO render from live content", async ({
  page,
}) => {
  const prisma = new PrismaClient(),
    key = randomUUID().slice(0, 8),
    slug = "components-" + key;
  const previous = await prisma.siteSetting.findUnique({
    where: { key: "navigation" },
  });
  const articleA = await prisma.cmsPage.create({
    data: {
      slug: "unselected-" + key,
      title: "Unselected article " + key,
      kind: "ARTICLE",
      category: "fixture-" + key,
      status: "PUBLISHED",
      sections: [],
    },
  });
  const articleB = await prisma.cmsPage.create({
    data: {
      slug: "selected-" + key,
      title: "Selected article " + key,
      kind: "ARTICLE",
      category: "fixture-" + key,
      status: "PUBLISHED",
      sections: [],
    },
  });
  const content = await prisma.cmsPage.create({
    data: {
      slug,
      title: "CMS live modules " + key,
      status: "PUBLISHED",
      sections: [
        {
          type: "hero",
          props: {
            id: "hero-fixture",
            title: "Video hero " + key,
            text: "Visible hero copy",
            src: "/fixture-video.mp4",
            poster: "/images/wemove-active-play-hero.png",
            align: "center",
            label: "Read selected article",
            href: "/content/" + articleB.slug,
            secondaryLabel: "Browse products",
            secondaryHref: "/products",
          },
        },
        {
          type: "text",
          props: {
            text: "UNPUBLISHED MODULE " + key,
            publishAt: new Date(Date.now() + 86400_000).toISOString(),
          },
        },
        {
          type: "text",
          props: { text: "DISABLED MODULE " + key, enabled: false },
        },
        {
          type: "articles",
          props: {
            id: "manual-articles",
            title: "Hand-picked articles",
            articleIds: [articleB.id],
            category: "fixture-" + key,
          },
        },
        {
          type: "text",
          props: { text: "Paragraph for scroll verification. ".repeat(180) },
        },
      ],
    },
  });
  const product = await prisma.product.create({
    data: {
      slug: "metadata-" + key,
      name: "Product heading " + key,
      summary: "Product summary",
      status: "ACTIVE",
      seo: {
        title: "Independent search title " + key,
        description: "Independent search description",
        ogTitle: "Independent social title",
        ogDescription: "Independent social description",
        ogImage: "/images/wemove-active-play-hero.png",
        canonical: "/en/products/metadata-" + key + "?market=US",
        noindex: true,
      },
    },
  });
  await prisma.cmsPage.update({
    where: { id: articleB.id },
    data: { productIds: [product.id] },
  });
  const questions = [];
  for (const [title, sortOrder, productIds] of [
    ["Second product FAQ " + key, 20, [product.id]],
    ["First product FAQ " + key, 10, [product.id]],
    ["General FAQ " + key, 0, []],
  ] as const) {
    questions.push(
      await prisma.cmsPage.create({
        data: {
          slug: "faq-" + questions.length + "-" + key,
          title,
          kind: "FAQ",
          status: "PUBLISHED",
          sortOrder,
          productIds: [...productIds],
          sections: [{ type: "text", props: { text: "Public answer " + key } }],
        },
      }),
    );
  }
  try {
    await prisma.siteSetting.upsert({
      where: { key: "navigation" },
      create: {
        key: "navigation",
        value: {
          items: [
            {
              label: "Explore " + key,
              href: "/content/" + slug,
              children: [
                {
                  label: "Secondary article " + key,
                  href: "/content/" + articleB.slug,
                },
              ],
            },
          ],
        },
      },
      update: {
        value: {
          items: [
            {
              label: "Explore " + key,
              href: "/content/" + slug,
              children: [
                {
                  label: "Secondary article " + key,
                  href: "/content/" + articleB.slug,
                },
              ],
            },
          ],
        },
      },
    });
    await page.addInitScript(() =>
      localStorage.setItem("wm_consent", "essential"),
    );
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto("/en/content/" + slug + "?market=US");
    const hero = page.locator('[data-module-id="hero-fixture"]');
    await expect(hero.locator("video")).toHaveAttribute(
      "poster",
      "/images/wemove-active-play-hero.png",
    );
    await expect(hero.locator("video source")).toHaveAttribute(
      "src",
      "/fixture-video.mp4",
    );
    await expect(hero.locator("div").first()).toHaveClass(/text-center/);
    await expect(page.getByText("UNPUBLISHED MODULE " + key)).toHaveCount(0);
    await expect(page.getByText("DISABLED MODULE " + key)).toHaveCount(0);
    const collection = page.locator('[data-module-id="manual-articles"]');
    await expect(
      collection.getByRole("link", { name: articleB.title, exact: true }),
    ).toBeVisible();
    await expect(
      collection.getByRole("link", { name: articleA.title, exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.locator("[data-header-compact]")).toHaveAttribute(
      "data-header-compact",
      "true",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Menu", exact: true });
    await expect(drawer).toBeVisible();
    await drawer
      .locator("summary")
      .filter({ hasText: "Explore " + key })
      .click();
    await expect(
      drawer.getByRole("link", {
        name: "Secondary article " + key,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Account", exact: true }),
    ).toHaveAttribute("href", "/en/login");
    await expect(
      drawer.getByRole("link", { name: "Dealer Sign in", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(menu).toBeFocused();
    await page.goto("/en/products/" + product.slug + "?market=US");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      product.name,
    );
    await expect(page).toHaveTitle(
      new RegExp("Independent search title " + key),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Independent search description",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Independent social title",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp("/en/products/metadata-" + key + "\\?market=US"),
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      page
        .locator("main details summary")
        .filter({ hasText: "First product FAQ " + key }),
    ).toBeVisible();
    await expect(
      page
        .locator("main details summary")
        .filter({ hasText: "General FAQ " + key }),
    ).toBeVisible();
    await page.goto("/en/content/" + articleB.slug + "?market=US");
    await expect(
      page
        .locator('[data-module-id="associated-products"]')
        .getByRole("link", { name: product.name }),
    ).toBeVisible();
    await page.goto("/en/support/faq?market=US&productId=" + product.id);
    await expect(page.locator("main details summary")).toHaveText([
      "First product FAQ " + key,
      "Second product FAQ " + key,
    ]);
  } finally {
    if (previous)
      await prisma.siteSetting.update({
        where: { key: "navigation" },
        data: { value: previous.value! },
      });
    else await prisma.siteSetting.deleteMany({ where: { key: "navigation" } });
    await prisma.cmsPage.deleteMany({
      where: {
        id: {
          in: [
            content.id,
            articleA.id,
            articleB.id,
            ...questions.map((q) => q.id),
          ],
        },
      },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  }
});

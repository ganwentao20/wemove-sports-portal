import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
test("product aggregate rating and visible summary follow the same explicit switch and never invent an empty rating", async ({
  page,
}) => {
  const prisma = new PrismaClient(),
    key = randomUUID().slice(0, 8);
  const rating = {
    enabled: false,
    average: 4.25,
    count: 12,
    source: "Synthetic browser verification fixture",
  };
  const product = await prisma.product.create({
    data: {
      name: "Rating verification " + key,
      slug: "rating-browser-" + key,
      status: "ACTIVE",
      specifications: { weight: "5 kg", reviews: rating },
    },
  });
  try {
    await page.addInitScript(() =>
      localStorage.setItem("wm_consent", "essential"),
    );
    const visit = () =>
      page.goto("/en/products/" + product.slug + "?market=US");
    const schema = async () => {
      const data = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      return data
        .flatMap((text) => {
          const value = JSON.parse(text);
          return Array.isArray(value) ? value : [value];
        })
        .find((value) => value["@type"] === "Product");
    };
    await visit();
    await expect(page.locator("[data-product-rating]")).toHaveCount(0);
    expect((await schema()).aggregateRating).toBeUndefined();
    await prisma.product.update({
      where: { id: product.id },
      data: {
        specifications: {
          weight: "5 kg",
          reviews: { ...rating, enabled: true },
        },
      },
    });
    await visit();
    await expect(page.locator("[data-product-rating]")).toContainText(
      "4.25 / 5",
    );
    await expect(page.locator("[data-product-rating]")).toContainText(
      "12 reviews",
    );
    expect((await schema()).aggregateRating).toMatchObject({
      ratingValue: 4.25,
      reviewCount: 12,
      bestRating: 5,
      worstRating: 1,
    });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        specifications: {
          weight: "5 kg",
          reviews: { ...rating, enabled: true, count: 0 },
        },
      },
    });
    await visit();
    await expect(page.locator("[data-product-rating]")).toHaveCount(0);
    expect((await schema()).aggregateRating).toBeUndefined();
  } finally {
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  }
});

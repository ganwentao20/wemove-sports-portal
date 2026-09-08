import { test, expect, chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";

test("mobile Lighthouse templates and public API latency meet the local acceptance targets", async ({
  request,
}) => {
  test.setTimeout(360000);
  const output = ".local/lighthouse";
  await mkdir(output, { recursive: true });
  const products = await request.get("/api/v1/products?market=US&pageSize=4");
  expect(products.ok()).toBe(true);
  const slug = (await products.json()).data.items[0]?.slug;
  expect(slug).toBeTruthy();
  const routes = [
    ["home", "/en?market=US"],
    ["products", "/en/products?market=US"],
    ["product", "/en/products/" + slug + "?market=US"],
    ["article", "/en/content/article-active-family-play?market=US"],
  ];
  const port = await new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
  const chrome = await chromium.launch({
    channel: process.platform === "win32" ? undefined : "chromium",
    args: [`--remote-debugging-port=${port}`],
  });
  const pages: Array<{
    template: string;
    lcpMs: number;
    cls: number;
    tbtMs: number;
    performance: number | null;
    accessibility: number | null;
    lcpSamples: number[];
  }> = [];
  try {
    for (const [template, path] of routes) {
      const samples = [];
      for (let run = 1; run <= 3; run++) {
        const result = await lighthouse("http://127.0.0.1:3000" + path, {
          port,
          logLevel: "error",
          output: ["json", "html"],
          onlyCategories: [
            "performance",
            "accessibility",
            "best-practices",
            "seo",
          ],
        });
        expect(result?.lhr.runtimeError, template).toBeUndefined();
        const lhr = result!.lhr;
        await writeFile(
          `${output}/${template}-${run}.json`,
          JSON.stringify(lhr, null, 2),
        );
        await writeFile(`${output}/${template}-${run}.html`, result!.report[1]);
        samples.push({
          lcpMs: lhr.audits["largest-contentful-paint"].numericValue!,
          cls: lhr.audits["cumulative-layout-shift"].numericValue!,
          tbtMs: lhr.audits["total-blocking-time"].numericValue!,
          performance: lhr.categories.performance.score ?? 0,
          accessibility: lhr.categories.accessibility.score ?? 0,
        });
      }
      const median = (values: number[]) =>
        values.slice().sort((a, b) => a - b)[1];
      pages.push({
        template,
        lcpMs: median(samples.map((row) => row.lcpMs)),
        lcpSamples: samples.map((row) => row.lcpMs),
        cls: Math.max(...samples.map((row) => row.cls)),
        tbtMs: median(samples.map((row) => row.tbtMs)),
        performance: median(samples.map((row) => row.performance)),
        accessibility: Math.min(...samples.map((row) => row.accessibility)),
      });
    }
  } finally {
    await chrome.close();
  }
  const apis: Array<{ path: string; samples: number; p95Ms: number }> = [];
  for (const path of [
    "/products?pageSize=20&market=US",
    "/products/" + slug + "?market=US",
    "/search?q=standard&market=US",
    "/cms/pages?kind=ARTICLE&market=US",
    "/site/config",
  ]) {
    const values: number[] = [];
    await request.get("/api/v1" + path);
    for (let batch = 0; batch < 6; batch++)
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          const start = performance.now(),
            response = await request.get("/api/v1" + path);
          expect(response.ok(), path).toBe(true);
          await response.body();
          values.push(performance.now() - start);
        }),
      );
    values.sort((a, b) => a - b);
    apis.push({
      path,
      samples: values.length,
      p95Ms: values[Math.ceil(values.length * 0.95) - 1],
    });
  }
  await writeFile(
    output + "/summary.json",
    JSON.stringify(
      {
        environment:
          "Production build; three cold-browser Lighthouse mobile runs per template; median LCP/TBT, worst CLS; not field Core Web Vitals",
        browser:
          process.platform === "win32"
            ? "Chromium headless shell"
            : "Chromium new headless",
        createdAt: new Date().toISOString(),
        pages,
        apis,
      },
      null,
      2,
    ),
  );
  for (const page of pages) {
    expect(page.lcpMs, page.template + " mobile LCP").toBeLessThanOrEqual(2500);
    expect(page.cls, page.template + " CLS").toBeLessThanOrEqual(0.1);
  }
  for (const api of apis)
    expect(api.p95Ms, api.path + " P95").toBeLessThan(500);
});

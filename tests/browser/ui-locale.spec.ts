import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import ts from "typescript";
import { translateUi, uiError } from "../../apps/web/lib/ui-i18n";
import { languageUrl } from "../../apps/web/lib/language-switch";
import { publicUrl } from "../../apps/web/lib/public-url";

test("language selection preserves query/hash and local login destinations", () => {
  const result = new URL(
    languageUrl(
      "https://example.test/en/login?market=US&next=%2Fen%2Fcustomer%2Faccount%3Ftab%3Dorders#form",
      "zh",
    ),
    "https://example.test",
  );
  expect(result.pathname).toBe("/zh/login");
  expect(result.searchParams.get("next")).toBe(
    "/zh/customer/account?tab=orders",
  );
  expect(result.searchParams.get("market")).toBe("US");
  expect(result.hash).toBe("#form");
  expect(languageUrl("/zh/about", "en")).toBe("/en/about");
  expect(publicUrl("https://partner.example/path", "zh", "US")).toBe(
    "https://partner.example/path",
  );
  expect(publicUrl("/products?sort=name#results", "zh", "US")).toBe(
    "/zh/products?sort=name&market=US#results",
  );
  expect(publicUrl("/api/v1/media/one", "zh", "US")).toBe("/api/v1/media/one");
});

test("UI translation retains data and whitespace, with localized error fallback", () => {
  expect(
    translateUi("zh", "Move social profile {number} up", { number: 3 }),
  ).toBe("上移第 3 个社交账号");
  expect(
    translateUi("en", "Move social profile {number} up", { number: 3 }),
  ).toBe("Move social profile 3 up");
  expect(translateUi("zh", "Save ")).toBe("保存 ");
  expect(translateUi("zh", "Missing description ")).toContain("缺少描述");
  expect(translateUi("zh", "A customer's own note")).toBe(
    "A customer's own note",
  );
  expect(uiError("zh", new Error("Failed to fetch"))).toMatch(/连接/);
  expect(uiError("zh", new Error("An unrecognized upstream failure"))).toMatch(
    /[\u3400-\u9fff]/,
  );
  expect(uiError("en", new Error("An unrecognized upstream failure"))).toBe(
    "An unrecognized upstream failure",
  );
});

test("every explicit UI message has a Chinese translation", () => {
  const missing: string[] = [];
  const technical = new Set([
    "SKU",
    "PDF",
    "WEMOVE",
    "· SHA-256",
    "{{name}}, {{email}}, {{subject}}, {{text}}, {{link}}, {{kind}}",
  ]);
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (file.endsWith(".tsx")) {
        const source = ts.createSourceFile(
          file,
          readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        function visit(node: ts.Node) {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "t" &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
          ) {
            const message = node.arguments[0].text;
            if (
              /[a-z]{3}/i.test(message) &&
              !/[\u3400-\u9fff]/.test(message) &&
              !technical.has(message.trim()) &&
              translateUi("zh", message) === message
            )
              missing.push(`${file}: ${message}`);
          }
          if (ts.isJsxText(node)) {
            const message = node.text.trim();
            if (
              /[a-z]{3}/i.test(message) &&
              !/[\u3400-\u9fff]/.test(message) &&
              !/^(?:©\s*)?(?:WEMOVE|WeMove)(?:\s*·)?$/.test(message)
            )
              missing.push(`${file}: untranslated JSX: ${message}`);
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  scan(resolve("apps/web/app"));
  scan(resolve("apps/web/components"));
  expect(missing).toEqual([]);
});

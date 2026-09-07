import test from "node:test";
import assert from "node:assert/strict";
import { safeRedirect } from "./safe-redirect.ts";
const fallback = "/customer/account";
test("allows local destinations and preserves query strings and fragments", () => {
  for (const value of [
    "/checkout",
    "/orders/example?market=US#payment",
    "/zh/products",
  ])
    assert.equal(safeRedirect(value, fallback), value);
  assert.equal(safeRedirect("/products/../checkout", fallback), "/checkout");
});
test("rejects external, scheme relative, browser-normalized and malformed redirect values", () => {
  for (const value of [
    null,
    undefined,
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%5cevil.test",
    "/\u0009/evil.test",
    "/%00evil.test",
    "/a/..//evil.test",
    "javascript:alert(1)",
    "/%zz",
  ])
    assert.equal(
      safeRedirect(value, fallback),
      fallback,
      `Rejected ${String(value)}`,
    );
});

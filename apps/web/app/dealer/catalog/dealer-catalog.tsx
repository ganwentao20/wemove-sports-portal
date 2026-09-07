"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type PriceSource =
  "COMPANY_SPECIFIC" | "PRICE_TABLE" | "TIER_LEVEL" | "B2B_DEFAULT";
type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  variants: Array<{
    id: string;
    sku: string;
    name: string | null;
    attrs: unknown;
    quantity: number;
    price: {
      priceCents: number;
      source: PriceSource;
      currency: string;
      validUntil?: string;
    };
    msrpCents: number | null;
    salePriceCents: number | null;
    weightGrams: number | null;
    available: number | null;
    availability: "IN_STOCK" | "LEAD_TIME" | "CHECK_AVAILABILITY";
    purchaseRules: {
      moq: number;
      multiple: number;
      caseSize: number;
      caseWeightGrams?: number;
      leadTimeDays: number;
    };
  }>;
};
const sourceLabels: Record<PriceSource, string> = {
  COMPANY_SPECIFIC: "Company price",
  PRICE_TABLE: "Price book",
  TIER_LEVEL: "Tier price",
  B2B_DEFAULT: "Dealer price",
};

export function DealerCatalog() {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function addSelected() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const current = await secureApiFetch<{
        lines: Array<{ sku: string; quantity: number }>;
      }>("dealer", "/dealer/cart");
      const merged = new Map(
        current.lines.map((line) => [line.sku, line.quantity]),
      );
      for (const sku of selected)
        merged.set(sku, (merged.get(sku) ?? 0) + quantity);
      await secureApiFetch("dealer", "/dealer/cart", {
        method: "PUT",
        body: JSON.stringify({
          lines: [...merged].map(([sku, quantity]) => ({ sku, quantity })),
        }),
      });
      setSelected([]);
      setNotice("Selected variants were added to your procurement cart.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProducts(
        await secureApiFetch<CatalogProduct[]>(
          "dealer",
          `/dealer/catalog?quantity=${quantity}`,
        ),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("dealer").catch(() => undefined);
        router.replace("/dealer/login");
        return;
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load dealer catalog.",
      );
    } finally {
      setLoading(false);
    }
  }, [quantity, router]);

  async function signOut() {
    await sessionLogout("dealer");
    router.replace("/dealer/login");
    router.refresh();
  }
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-[#2B5F8A]">
          APPROVED DEALER CATALOG
        </p>
        <button
          onClick={() => void signOut()}
          className="text-sm text-neutral-500 underline"
        >
          Sign out
        </button>
      </div>
      <h1 className="mt-1 text-3xl font-bold">Your wholesale prices</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Prices are resolved for your company and update with order quantity.
      </p>
      <label className="mt-6 block max-w-xs text-sm font-medium">
        Planned quantity
        <input
          type="number"
          min={1}
          max={10000}
          value={quantity}
          onChange={(event) =>
            setQuantity(
              Math.max(1, Math.min(10000, Number(event.target.value) || 1)),
            )
          }
          className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          disabled={saving || !selected.length}
          onClick={() => void addSelected()}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Add selected variants ({selected.length})
        </button>
        <Link href="/dealer/quick-order" className="underline">
          Review procurement cart
        </Link>
        <span role="status">{notice}</span>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-8 text-neutral-500">Resolving prices…</p>
      ) : products.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-neutral-500">
          No authorized products are available.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {products.map((product) => (
            <article
              key={product.id}
              className="rounded-xl border border-neutral-200 p-5"
            >
              <h2 className="text-xl font-semibold">{product.name}</h2>
              {product.summary && (
                <p className="mt-1 text-sm text-neutral-500">
                  {product.summary}
                </p>
              )}
              <div className="mt-4 divide-y">
                {product.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        <input
                          aria-label={`Select ${variant.sku}`}
                          type="checkbox"
                          className="mr-2"
                          checked={selected.includes(variant.sku)}
                          onChange={(event) =>
                            setSelected((items) =>
                              event.target.checked
                                ? [...items, variant.sku]
                                : items.filter((sku) => sku !== variant.sku),
                            )
                          }
                        />
                        {variant.name || variant.sku}
                      </p>
                      <p className="text-xs text-neutral-500">
                        SKU {variant.sku} · {sourceLabels[variant.price.source]}
                      </p>
                      <p className="mt-1 text-xs">
                        MOQ {variant.purchaseRules.moq} · multiple{" "}
                        {variant.purchaseRules.multiple} · case{" "}
                        {variant.purchaseRules.caseSize}
                        {variant.purchaseRules.caseWeightGrams
                          ? " · case gross weight " +
                            variant.purchaseRules.caseWeightGrams +
                            " g"
                          : ""}{" "}
                        · lead time {variant.purchaseRules.leadTimeDays} days
                        {variant.weightGrams
                          ? ` · ${variant.weightGrams} g each`
                          : ""}
                      </p>
                      {variant.msrpCents != null && (
                        <p className="text-xs">
                          MSRP USD {(variant.msrpCents / 100).toFixed(2)}
                          {variant.salePriceCents != null
                            ? ` · Retail sale USD ${(variant.salePriceCents / 100).toFixed(2)}`
                            : ""}
                        </p>
                      )}
                      {variant.quantity > quantity && (
                        <p className="text-xs">
                          Price shown for {variant.quantity}+ units; lower
                          quantities have no current company price.
                        </p>
                      )}
                      {variant.price.validUntil && (
                        <p className="text-xs">
                          Price valid until{" "}
                          {new Date(
                            variant.price.validUntil,
                          ).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-xs">
                        {variant.availability === "CHECK_AVAILABILITY"
                          ? "Contact sales to confirm inventory"
                          : variant.available != null
                            ? `${variant.available} units available`
                            : variant.availability === "IN_STOCK"
                              ? "In stock"
                              : "Contact sales for lead time"}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-lg font-bold">
                      {variant.price.currency}{" "}
                      {(variant.price.priceCents / 100).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

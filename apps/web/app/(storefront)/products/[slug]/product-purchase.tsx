"use client";

import { useMemo, useState } from "react";
import { productCopy } from "../../../../lib/product-copy";
import { ApiError } from "../../../../lib/api";
import { secureApiFetch } from "../../../../lib/secure-api";
import { useProductSelection } from "../../../../components/product-selection";
import { recordEvent } from "../../../../components/consent-analytics";

type Variant = {
  id: string;
  sku: string;
  name: string | null;
  attrs: unknown;
  price: { priceCents: number; source: "SALE" | "MSRP" } | null;
  availability?: string;
  purchasable?: boolean;
  leadTimeDays?: number;
  availableQuantity?: number;
  inventoryLevel?: string;
};

export function ProductPurchase({
  productId,
  market = "US",
  productSlug,
  variants,
  retailEnabled = true,
  currency = "USD",
  locale = "en",
}: {
  productId: string;
  market?: string;
  productSlug: string;
  variants: Variant[];
  retailEnabled?: boolean;
  currency?: string;
  locale?: string;
}) {
  const copy = productCopy(locale);
  const selection = useProductSelection();
  const firstAvailable =
    variants.find((item) => item.price)?.id ?? variants[0]?.id ?? "";
  const [variantId, setVariantId] = useState(firstAvailable);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selected = useMemo(
    () => variants.find((item) => item.id === variantId),
    [variantId, variants],
  );
  const attributes = useMemo(() => {
    if (
      !selected?.attrs ||
      typeof selected.attrs !== "object" ||
      Array.isArray(selected.attrs)
    )
      return [];
    return Object.entries(selected.attrs as Record<string, unknown>)
      .filter(([, value]) =>
        ["string", "number", "boolean"].includes(typeof value),
      )
      .map(([key, value]) => [key, String(value)] as const);
  }, [selected]);

  async function addToCart() {
    if (!selected?.price) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await secureApiFetch("customer", "/cart/items", {
        method: "POST",
        body: JSON.stringify({ variantId: selected.id, quantity, market }),
      });
      setMessage(copy.added);
      recordEvent("add_to_cart", {
        product_id: productId,
        variant_id: selected.id,
        quantity,
        currency,
        value: selected.price.priceCents * quantity,
        guest: false,
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        const cart = JSON.parse(
          localStorage.getItem("wm-guest-cart") ?? "[]",
        ) as Array<{
          variantId: string;
          sku: string;
          name: string;
          quantity: number;
          unitPriceCents: number;
        }>;
        const existing = cart.find((item) => item.variantId === selected.id);
        if (existing)
          existing.quantity = Math.min(99, existing.quantity + quantity);
        else
          cart.push({
            variantId: selected.id,
            sku: selected.sku,
            name: selected.name || productSlug,
            quantity,
            unitPriceCents: selected.price.priceCents,
          });
        localStorage.setItem("wm-guest-cart", JSON.stringify(cart));
        recordEvent("add_to_cart", {
          product_id: productId,
          variant_id: selected.id,
          quantity,
          currency,
          value: selected.price.priceCents * quantity,
          guest: true,
        });
        setMessage(copy.guestAdded);
        return;
      }
      setError(
        locale === "en" && cause instanceof ApiError
          ? cause.message
          : copy.addError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (variants.length === 0)
    return (
      <p className="mt-6 rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-5 text-sm text-[var(--wm-muted)]">
        {copy.notAvailable}
      </p>
    );

  if (!retailEnabled)
    return (
      <div className="mt-6 space-y-3 rounded-xl border p-5">
        <p>{copy.retailer}</p>
        <a className="font-semibold underline" href="/dealers">
          {copy.where}
        </a>{" "}
        ·{" "}
        <a className="underline" href="/contact">
          {copy.contact}
        </a>
      </div>
    );

  return (
    <div className="mt-7 space-y-5 rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-5 shadow-[0_18px_50px_rgba(var(--wm-shadow)/0.07)] sm:p-6">
      <label className="block text-sm font-medium">
        {copy.variant}
        <select
          value={variantId}
          onChange={(event) => {
            setVariantId(event.target.value);
            selection?.select(event.target.value);
          }}
          className="mt-2 w-full rounded-xl border border-[var(--wm-border)] bg-[var(--wm-bg)] px-3 py-3 text-[var(--wm-text)] focus:border-[var(--wm-primary)]"
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.name || variant.sku}
              {variant.price
                ? `, ${currency} ${(variant.price.priceCents / 100).toFixed(2)}`
                : `, ${copy.unavailableOption}`}
            </option>
          ))}
        </select>
      </label>
      {attributes.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-[var(--wm-surface-soft)] p-4 text-sm">
          {attributes.map(([key, value]) => (
            <div key={key}>
              <dt className="text-[var(--wm-muted)]">{key}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <label className="block text-sm font-medium">
        {copy.quantity}
        <input
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(event) =>
            setQuantity(
              Math.max(1, Math.min(99, Number(event.target.value) || 1)),
            )
          }
          className="mt-2 w-28 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-bg)] px-3 py-3 text-[var(--wm-text)] focus:border-[var(--wm-primary)]"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}{" "}
          <a href="/checkout" className="font-semibold underline">
            {copy.viewCart}
          </a>
        </p>
      )}
      <button
        onClick={() => void addToCart()}
        disabled={
          !selected?.price || selected.purchasable === false || submitting
        }
        className="w-full rounded-xl bg-[var(--wm-primary)] py-3.5 text-sm font-bold text-white transition hover:bg-[var(--wm-primary-strong)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? copy.adding
          : selected?.price
            ? `${selected.availability === "OUT_OF_STOCK" ? copy.outOfStock : selected.availability === "CHECK_AVAILABILITY" ? copy.checkAvailability : selected.availability === "PREORDER" ? copy.preorder : selected.availability === "BACKORDER" ? copy.backorder : copy.addToCart}, ${currency} ${((selected.price.priceCents * quantity) / 100).toFixed(2)}`
            : copy.unavailableOption}
      </button>
      {(selected?.availableQuantity !== undefined ||
        selected?.inventoryLevel ||
        selected?.leadTimeDays) && (
        <p className="text-sm text-neutral-600">
          {selected.availableQuantity !== undefined
            ? `${copy.available.replace("{n}", String(selected.availableQuantity))} `
            : ""}
          {selected.inventoryLevel
            ? `${copy.stockLevel}: ${selected.inventoryLevel === "LOW" ? copy.low : copy.normal}. `
            : ""}
          {selected.leadTimeDays
            ? copy.dispatch.replace("{n}", String(selected.leadTimeDays))
            : ""}
        </p>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../lib/api";
import { secureApiFetch } from "../../../../lib/secure-api";

type Variant = {
  id: string;
  sku: string;
  name: string | null;
  attrs: unknown;
  price: { priceCents: number; source: "SALE" | "MSRP" } | null;
};

export function ProductPurchase({
  productSlug,
  variants,
}: {
  productSlug: string;
  variants: Variant[];
}) {
  const router = useRouter();
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

  async function addToCart() {
    if (!selected?.price) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await secureApiFetch("customer", "/cart/items", {
        method: "POST",
        body: JSON.stringify({ variantId: selected.id, quantity }),
      });
      setMessage("Added to your cart.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.push(
          `/customer/login?next=${encodeURIComponent(`/products/${productSlug}`)}`,
        );
        return;
      }
      setError(
        cause instanceof ApiError ? cause.message : "Unable to add this item.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (variants.length === 0)
    return (
      <p className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">
        This product is not currently available.
      </p>
    );

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-neutral-200 p-5">
      <label className="block text-sm font-medium">
        Variant
        <select
          value={variantId}
          onChange={(event) => setVariantId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3"
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.name || variant.sku}
              {variant.price
                ? ` — $${(variant.price.priceCents / 100).toFixed(2)}`
                : " — unavailable"}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Quantity
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
          className="mt-2 w-28 rounded-xl border border-neutral-300 px-3 py-3"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}{" "}
          <a href="/customer/account" className="font-semibold underline">
            View cart
          </a>
        </p>
      )}
      <button
        onClick={() => void addToCart()}
        disabled={!selected?.price || submitting}
        className="w-full rounded-full bg-[var(--wm-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting
          ? "Adding…"
          : selected?.price
            ? `Add to cart · $${((selected.price.priceCents * quantity) / 100).toFixed(2)}`
            : "Unavailable"}
      </button>
    </div>
  );
}

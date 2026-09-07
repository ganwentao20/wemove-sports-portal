"use client";
import { useState } from "react";
import { secureApiFetch } from "../../../lib/secure-api";
export function ProductRatingEditor({
  productId,
  value,
  mfa,
  onSaved,
}: {
  productId: string;
  value: unknown;
  mfa: string;
  onSaved: () => Promise<void>;
}) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const input = "mt-1 block w-full rounded border border-neutral-300 p-2";
  return (
    <section className="mt-8 rounded-xl border p-5">
      <h3 className="text-xl font-bold">Product rating display</h3>
      <p className="mt-2 text-sm text-neutral-600">
        This is an optional aggregate of existing reviews. Enter a real source
        and its actual five-point average and count. The default is hidden;
        empty review sets are never presented as a rating.
      </p>
      <form
        key={productId + JSON.stringify(value)}
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          if (!/^\d{6}$/.test(mfa)) {
            setError("Enter your current MFA code above.");
            return;
          }
          const form = new FormData(e.currentTarget),
            enabled = form.get("enabled") === "on";
          if (enabled && form.get("authentic") !== "on") {
            setError("Confirm the aggregate comes from authentic reviews.");
            return;
          }
          setBusy(true);
          try {
            await secureApiFetch(
              "staff",
              "/admin/catalog/products/" + productId + "/reviews",
              {
                method: "PATCH",
                headers: { "x-mfa-code": mfa },
                body: JSON.stringify({
                  enabled,
                  average: Number(form.get("average")),
                  count: Number(form.get("count")),
                  source: String(form.get("source")).trim(),
                }),
              },
            );
            await onSaved();
            setMessage("Rating display saved.");
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="sm:col-span-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={current.enabled === true}
          />{" "}
          Show the aggregate rating on this product page
        </label>
        <label>
          Average out of five
          <input
            className={input}
            name="average"
            type="number"
            min="0"
            max="5"
            step="0.01"
            required
            defaultValue={Number(current.average ?? 0)}
          />
        </label>
        <label>
          Number of reviews
          <input
            className={input}
            name="count"
            type="number"
            min="0"
            max="2147483647"
            step="1"
            required
            defaultValue={Number(current.count ?? 0)}
          />
        </label>
        <label>
          Review source
          <input
            className={input}
            name="source"
            maxLength={300}
            defaultValue={String(current.source ?? "")}
            placeholder="Verified review provider or source record"
          />
        </label>
        <label className="sm:col-span-3">
          <input type="checkbox" name="authentic" /> I confirm these values
          match authentic reviews for this product from the stated source.
        </label>
        <button
          className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-40"
          disabled={busy}
        >
          Save rating display
        </button>
        {error && (
          <p role="alert" className="text-red-700 sm:col-span-3">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="sm:col-span-3">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}

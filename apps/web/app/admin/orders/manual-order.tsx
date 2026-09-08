"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { useEffect, useState, type FormEvent } from "react";
import { secureApiFetch } from "../../../lib/secure-api";
const input = "mt-1 block w-full rounded-lg border p-2.5";
export function ManualOrder() {
  const t = useUiText();
  const uiLocale = useUiLocale();

  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [variants, setVariants] = useState<
    Array<{ id: string; sku: string; name: string }>
  >([]);
  const [lines, setLines] = useState<
    Array<{ variantId: string; quantity: number }>
  >([{ variantId: "", quantity: 1 }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([
      secureApiFetch<typeof customers>("staff", "/admin/commerce/customers"),
      secureApiFetch<typeof variants>("staff", "/admin/commerce/order-catalog"),
    ])
      .then(([c, v]) => {
        setCustomers(c);
        setVariants(v);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const shippingAddress = Object.fromEntries(
        [
          "recipient",
          "phone",
          "country",
          "region",
          "city",
          "postalCode",
          "line1",
          "line2",
        ].map((k) => [k, String(f.get(k) ?? "")]),
      );
      const order = await secureApiFetch<{ id: string }>(
        "staff",
        "/admin/commerce/orders",
        {
          method: "POST",
          headers: { "x-mfa-code": String(f.get("mfa")) },
          body: JSON.stringify({
            userId: f.get("userId"),
            reason: f.get("reason"),
            market: String(f.get("market")).toUpperCase(),
            shippingAddress,
            items: lines,
          }),
        },
      );
      window.location.assign(`/admin/orders/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-7xl px-4 pb-12">
      <details className="rounded-xl border p-5">
        <summary className="cursor-pointer text-xl font-bold">
          {t("Create an assisted customer order")}
        </summary>
        <p className="mt-3 text-sm">
          {t(
            "Current catalog prices, stock, tax and shipping rules apply. The customer completes payment from their account; their existing cart is preserved.",
          )}
        </p>
        {error && (
          <p role="alert" className="mt-3 bg-red-50 p-3 text-red-800">
            {error ? uiError(uiLocale, error) : ""}
          </p>
        )}
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-3">
          <label>
            {t("Customer")}
            <select name="userId" className={input} required>
              <option value="">{t("Select customer")}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Market code")}
            <input
              name="market"
              className={input}
              defaultValue="US"
              required
              maxLength={2}
            />
          </label>
          <label>
            {t("Current MFA code")}
            <input
              name="mfa"
              className={input}
              inputMode="numeric"
              maxLength={6}
              required
            />
          </label>
          {[
            ["recipient", "Recipient"],
            ["phone", "Phone"],
            ["country", "Country code"],
            ["region", "Region"],
            ["city", "City"],
            ["postalCode", "Postal code"],
            ["line1", "Address line 1"],
            ["line2", "Address line 2"],
          ].map(([name, label]) => (
            <label key={name}>
              {t(String(label))}
              <input
                name={name}
                className={input}
                required={!["line2", "region"].includes(name)}
              />
            </label>
          ))}
          <label>
            {t("Reason for assisted order")}
            <input name="reason" className={input} minLength={3} required />
          </label>
          <div className="space-y-3 sm:col-span-3">
            {lines.map((line, index) => (
              <div key={index} className="flex gap-3">
                <label className="grow">
                  {t("SKU")}
                  <select
                    className={input}
                    value={line.variantId}
                    required
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) =>
                          i === index ? { ...l, variantId: e.target.value } : l,
                        ),
                      )
                    }
                  >
                    <option value="">{t("Select SKU")}</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku} · {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Quantity")}
                  <input
                    className={input}
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) =>
                          i === index
                            ? { ...l, quantity: Number(e.target.value) }
                            : l,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="self-end rounded-lg border p-2.5"
                  disabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                >
                  {t("Remove")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-lg border px-4 py-2"
              onClick={() =>
                setLines([...lines, { variantId: "", quantity: 1 }])
              }
            >
              {t("Add line")}
            </button>
          </div>
          <button
            className="rounded-lg bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-40"
            disabled={busy}
          >
            {t("Create unpaid order")}
          </button>
        </form>
      </details>
    </section>
  );
}

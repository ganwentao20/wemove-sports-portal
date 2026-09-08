"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "../../../lib/api";
import { secureApiFetch } from "../../../lib/secure-api";
import { localizeGuestCart } from "../../../lib/guest-cart-locale";
import { recordEvent } from "../../../components/consent-analytics";
import { publicUrl } from "../../../lib/public-url";

type Address = {
  id?: string;
  label?: string;
  recipient: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  postalCode: string;
  line1: string;
  line2?: string;
};
type Market = {
  code: string;
  label: string;
  currency: string;
  retailEnabled: boolean;
  paymentMode: string;
};
type Cart = {
  items: Array<{
    variantId: string;
    productSlug?: string;
    sku: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }>;
};
type Quote = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentMode: string;
  lines: Array<{
    sku: string;
    unitPriceCents: number;
    previousUnitPriceCents: number;
  }>;
};
const empty: Address = {
  recipient: "",
  phone: "",
  country: "US",
  region: "",
  city: "",
  postalCode: "",
  line1: "",
  line2: "",
};
const input = "mt-1 w-full rounded-lg border border-neutral-300 p-3";
export function Checkout() {
  const t = useUiText();
  const uiLocale = useUiLocale();
  const router = useRouter();
  const [cart, setCart] = useState<Cart>({ items: [] });
  const [markets, setMarkets] = useState<Market[]>([]);
  const [market, setMarket] = useState("US");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [shipping, setShipping] = useState<Address>(empty);
  const [billing, setBilling] = useState<Address>(empty);
  const [same, setSame] = useState(true);
  const [coupon, setCoupon] = useState("");
  const [method, setMethod] = useState("STANDARD");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingCart, setLoadingCart] = useState(true);
  const [guest, setGuest] = useState(false);
  const [unmerged, setUnmerged] = useState<Cart["items"]>([]);
  const current = markets.find((m) => m.code === market);
  const money = (
    n: number,
    c = quote?.currency ?? current?.currency ?? "USD",
  ) =>
    new Intl.NumberFormat(uiLocale, { style: "currency", currency: c }).format(
      n / 100,
    );
  async function load() {
    setLoadingCart(true);
    try {
      const [c, a] = await Promise.all([
        secureApiFetch<Cart>("customer", `/cart?locale=${uiLocale}`),
        secureApiFetch<Address[]>("customer", "/account/addresses"),
      ]);
      setCart(c);
      setAddresses(a);
      if (a[0]) setShipping(a[0]);
      const saved = JSON.parse(
        localStorage.getItem("wm-guest-cart") ?? "[]",
      ) as Array<{ variantId: string; quantity: number }>;
      if (saved.length) {
        setUnmerged(saved as Cart["items"]);
        let key = localStorage.getItem("wm-guest-merge-key");
        if (!key) {
          key = crypto.randomUUID();
          localStorage.setItem("wm-guest-merge-key", key);
        }
        await secureApiFetch<Cart>("customer", "/cart/merge", {
          method: "POST",
          body: JSON.stringify({
            market:
              new URLSearchParams(location.search).get("market") ??
              document.cookie
                .split("; ")
                .find((c) => c.startsWith("wm_market="))
                ?.split("=")[1] ??
              market,
            idempotencyKey: key,
            items: saved.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
            })),
          }),
        });
        setCart(
          await secureApiFetch<Cart>("customer", `/cart?locale=${uiLocale}`),
        );
        setUnmerged([]);
        localStorage.removeItem("wm-guest-cart");
        localStorage.removeItem("wm-guest-merge-key");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setGuest(true);
        const rows = JSON.parse(localStorage.getItem("wm-guest-cart") ?? "[]");
        const savedMarket =
          new URLSearchParams(location.search).get("market") ??
          document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith("wm_market="))
            ?.split("=")[1] ??
          market;
        const localized = await localizeGuestCart(
          rows,
          uiLocale,
          savedMarket,
          apiFetch,
        );
        setCart({ items: localized });
        localStorage.setItem("wm-guest-cart", JSON.stringify(localized));
      } else setError(e instanceof Error ? e.message : "Cart unavailable");
    } finally {
      setLoadingCart(false);
    }
  }
  useEffect(() => {
    void apiFetch<Market[]>("/commerce/markets")
      .then(setMarkets)
      .catch((e) => setError(e.message));
    const m =
      new URLSearchParams(location.search).get("market") ??
      document.cookie
        .split("; ")
        .find((c) => c.startsWith("wm_market="))
        ?.split("=")[1];
    if (m) setMarket(m);
    void load();
  }, [uiLocale]);
  function body() {
    const snap = (a: Address) => ({
      recipient: a.recipient,
      phone: a.phone,
      country: a.country,
      region: a.region,
      city: a.city,
      postalCode: a.postalCode,
      line1: a.line1,
      line2: a.line2,
    });
    return {
      market,
      couponCode: coupon || undefined,
      shippingMethod: method,
      shippingAddress: snap(shipping),
      billingAddress: snap(same ? shipping : billing),
    };
  }
  function editUnmerged(id: string, quantity: number) {
    const rows = unmerged
      .map((r) => (r.variantId === id ? { ...r, quantity } : r))
      .filter((r) => r.quantity > 0);
    setUnmerged(rows);
    localStorage.setItem("wm-guest-cart", JSON.stringify(rows));
    localStorage.removeItem("wm-guest-merge-key");
    setQuote(null);
  }
  async function preview(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    recordEvent("begin_checkout", {
      market,
      role: "CUSTOMER",
      cart_value:
        cart.items.reduce(
          (sum, item) => sum + item.unitPriceCents * item.quantity,
          0,
        ) / 100,
      item_count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    });
    try {
      setQuote(
        await secureApiFetch<Quote>("customer", "/orders/quote", {
          method: "POST",
          body: JSON.stringify(body()),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to calculate totals");
    } finally {
      setBusy(false);
    }
  }
  async function place() {
    setBusy(true);
    setError("");
    try {
      const order = await secureApiFetch<{ id: string }>(
        "customer",
        "/orders/checkout",
        { method: "POST", body: JSON.stringify(body()) },
      );
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to place order");
      setQuote(null);
    } finally {
      setBusy(false);
    }
  }
  async function quantity(id: string, q: number) {
    try {
      if (guest) {
        const rows = cart.items
          .map((r) => (r.variantId === id ? { ...r, quantity: q } : r))
          .filter((r) => r.quantity > 0);
        localStorage.setItem("wm-guest-cart", JSON.stringify(rows));
        setCart({ items: rows });
      } else {
        await secureApiFetch<Cart>("customer", `/cart/items/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: q, market }),
        });
        setCart(
          await secureApiFetch<Cart>("customer", `/cart?locale=${uiLocale}`),
        );
      }
      setQuote(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const addressForm = (
    value: Address,
    set: (a: Address) => void,
    prefix: string,
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {(
        [
          "recipient",
          "phone",
          "country",
          "region",
          "city",
          "postalCode",
          "line1",
          "line2",
        ] as const
      ).map((k) => (
        <label key={k} className="text-sm font-medium">
          {t(prefix)}{" "}
          {t(
            {
              recipient: "recipient",
              phone: "phone",
              country: "country (ISO code)",
              region: "state / region",
              city: "city",
              postalCode: "postal code",
              line1: "address line 1",
              line2: "address line 2 (optional)",
            }[k],
          )}
          <input
            className={input}
            value={value[k] ?? ""}
            required={!["line2", "region"].includes(k)}
            maxLength={k === "country" ? 2 : 200}
            onChange={(e) => {
              set({
                ...value,
                [k]:
                  k === "country"
                    ? e.target.value.toUpperCase()
                    : e.target.value,
              });
              setQuote(null);
            }}
          />
        </label>
      ))}
    </div>
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-bold">{t("Your cart & checkout")}</h1>
      {error && (
        <p role="alert" className="my-4 rounded bg-red-50 p-4 text-red-800">
          {uiError(uiLocale, error)}
        </p>
      )}
      {!guest && unmerged.length > 0 && (
        <section className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold">{t("Guest items awaiting merge")}</h2>
          <p className="my-2 text-sm">
            {t(
              "Reduce unavailable quantities or remove an item, then retry. Your signed-in cart is shown below.",
            )}
          </p>
          {unmerged.map((line) => (
            <div
              key={line.variantId}
              className="my-3 flex flex-wrap items-center gap-3"
            >
              <span>{line.name || line.sku || line.variantId}</span>
              <label>
                {t("Quantity")}{" "}
                <input
                  className="w-20 rounded border p-2"
                  type="number"
                  min={0}
                  max={99}
                  value={line.quantity}
                  onChange={(e) =>
                    editUnmerged(line.variantId, Number(e.target.value))
                  }
                />
              </label>
              <button
                type="button"
                className="underline"
                onClick={() => editUnmerged(line.variantId, 0)}
              >
                {t("Remove")}
              </button>
            </div>
          ))}
          <button
            className="rounded-lg border bg-white px-4 py-2"
            type="button"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            {t("Retry merge")}
          </button>
        </section>
      )}
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <section className="space-y-4">
            {loadingCart ? (
              <p>{t("Loading…")}</p>
            ) : cart.items.length ? (
              cart.items.map((line) => (
                <div
                  key={line.variantId}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-4"
                >
                  <span>{line.name || line.sku || line.variantId}</span>
                  <label>
                    {t("Quantity")}{" "}
                    <input
                      className="w-20 rounded border p-2"
                      type="number"
                      min="0"
                      max="99"
                      value={line.quantity}
                      onChange={(e) =>
                        void quantity(line.variantId, Number(e.target.value))
                      }
                    />
                  </label>
                  <span>
                    {money((line.unitPriceCents ?? 0) * line.quantity)}
                  </span>
                </div>
              ))
            ) : (
              <p>
                {t("Your cart is empty.")}{" "}
                <Link className="underline" href="/products">
                  {t("Browse products")}
                </Link>
              </p>
            )}
          </section>
          {guest ? (
            <p className="mt-6 rounded bg-blue-50 p-5">
              {t("Your cart is saved on this device.")}{" "}
              <Link
                className="font-bold underline"
                href={publicUrl("/login?next=%2Fcheckout", uiLocale, market)}
              >
                {t("Sign in to merge it and check out")}
              </Link>
              .
            </p>
          ) : (
            <form onSubmit={preview} className="mt-8 space-y-6">
              <label className="block">
                {t("Market")}
                <select
                  className={input}
                  value={market}
                  onChange={(e) => {
                    setMarket(e.target.value);
                    setQuote(null);
                  }}
                >
                  {markets.map((m) => (
                    <option key={m.code} value={m.code}>
                      {t(m.label)} · {m.currency}
                    </option>
                  ))}
                </select>
              </label>
              {current && !current.retailEnabled ? (
                <p>
                  {t("Online retail is closed in this market.")}{" "}
                  <Link className="underline" href="/dealers">
                    {t("Where to Buy")}
                  </Link>{" "}
                  ·{" "}
                  <Link className="underline" href="/contact">
                    {t("Contact us")}
                  </Link>
                </p>
              ) : (
                <>
                  <h2 className="text-xl font-semibold">
                    {t("Shipping address")}
                  </h2>
                  {addresses.length > 0 && (
                    <label className="block">
                      {t("Use saved address")}
                      <select
                        className={input}
                        onChange={(e) => {
                          const a = addresses.find(
                            (a) => a.id === e.target.value,
                          );
                          if (a) setShipping(a);
                          setQuote(null);
                        }}
                      >
                        <option value="">{t("Enter address")}</option>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label || a.recipient} · {a.line1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {addressForm(shipping, setShipping, "Shipping")}
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={same}
                      onChange={(e) => {
                        setSame(e.target.checked);
                        setQuote(null);
                      }}
                    />
                    {t("Billing address is the same")}
                  </label>
                  {!same && addressForm(billing, setBilling, "Billing")}
                  <label className="block">
                    {t("Delivery")}
                    <select
                      className={input}
                      value={method}
                      onChange={(e) => {
                        setMethod(e.target.value);
                        setQuote(null);
                      }}
                    >
                      <option value="STANDARD">{t("Standard")}</option>
                      <option value="EXPRESS">{t("Express")}</option>
                    </select>
                  </label>
                  <label className="block">
                    {t("Discount code")}
                    <input
                      className={input}
                      value={coupon}
                      onChange={(e) => {
                        setCoupon(e.target.value.toUpperCase());
                        setQuote(null);
                      }}
                    />
                  </label>
                  <button
                    disabled={busy || !cart.items.length || unmerged.length > 0}
                    className="rounded bg-[var(--wm-primary)] px-6 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {busy
                      ? t("Calculating…")
                      : t("Review current prices & totals")}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
        <aside className="h-fit rounded-xl border p-6">
          <h2 className="text-xl font-semibold">{t("Order review")}</h2>
          {quote ? (
            <>
              <dl className="mt-4 space-y-3">
                {[
                  ["Items", quote.subtotalCents],
                  ["Discount", -quote.discountCents],
                  ["Shipping", quote.shippingCents],
                  ["Tax", quote.taxCents],
                  ["Total", quote.totalCents],
                ].map(([label, value]) => (
                  <div key={t(String(label))} className="flex justify-between">
                    <dt>{t(String(label))}</dt>
                    <dd>{money(Number(value))}</dd>
                  </div>
                ))}
              </dl>
              {quote.lines.some(
                (l) => l.unitPriceCents !== l.previousUnitPriceCents,
              ) && (
                <p role="status" className="mt-3 text-amber-800">
                  {t(
                    "Prices changed since items were added. These are the current prices.",
                  )}
                </p>
              )}
              <p className="mt-4 text-sm">
                {quote.paymentMode === "DEMO"
                  ? t("Demo payment: no real money is charged.")
                  : t(
                      "Payment is confirmed by the configured provider integration.",
                    )}
              </p>
              <button
                disabled={busy}
                onClick={() => void place()}
                className="mt-5 w-full rounded bg-neutral-900 p-3 font-semibold text-white"
              >
                {t("Place order & continue to payment")}
              </button>
            </>
          ) : (
            <p className="mt-4 text-sm text-neutral-600">
              {t(
                "Enter your address and review current prices, tax and delivery charges before placing the order.",
              )}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { secureApiFetch } from "../../../lib/secure-api";
import { MarketRulesFields, type MarketRules } from "./market-rules-fields";
type Market = MarketRules & {
  code: string;
  label: string;
  currency: string;
  retailEnabled: boolean;
  countries: string[];
  taxBps: number;
  shippingCents: number;
  expressCents: number;
  freeShippingAboveCents: number | null;
  reservationMinutes: number;
  paymentMode: string;
};
type Coupon = {
  code: string;
  market: string;
  percentBps: number;
  amountCents: number;
  minimumCents: number;
  active: boolean;
  freeShipping: boolean;
  uses: number;
  maxUses?: number;
  startsAt?: string;
  endsAt?: string;
  productIds: string[];
  userIds: string[];
  perUserLimit?: number;
};
type Rule = {
  id: string;
  variantId: string;
  scope: string;
  priceCents: number;
  minQty: number;
  active: boolean;
  market?: string;
  currency: string;
  startsAt?: string;
  endsAt?: string;
  companyId?: string;
  bookId?: string;
  tierId?: string;
  priority: number;
};
const dateInput = (value?: string) =>
  value
    ? new Date(
        new Date(value).getTime() -
          new Date(value).getTimezoneOffset() * 60_000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
const input = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
const button =
  "rounded-lg border px-4 py-2.5 font-semibold text-sm disabled:opacity-40";
const split = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
export function PricingWorkbench() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [selected, setSelected] = useState<Market | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [mfa, setMfa] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [m, c, r] = await Promise.all([
        secureApiFetch<Market[]>("staff", "/admin/commerce/markets"),
        secureApiFetch<Coupon[]>("staff", "/admin/commerce/coupons"),
        secureApiFetch<{ items: Rule[] }>(
          "staff",
          "/admin/pricing-rules?pageSize=100",
        ),
      ]);
      setMarkets(m);
      setCoupons(c);
      setRules(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(path: string, data: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await secureApiFetch("staff", path, {
        method,
        headers: { "x-mfa-code": mfa },
        body: JSON.stringify(data),
      });
      setNotice("Changes saved.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function market(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void save("/admin/commerce/markets", {
      code: String(f.get("code")).toUpperCase(),
      label: f.get("label"),
      currency: String(f.get("currency")).toUpperCase(),
      retailEnabled: f.get("retailEnabled") === "on",
      countries: split(f.get("countries")).map((c) => c.toUpperCase()),
      taxBps: Math.round(Number(f.get("tax")) * 100),
      shippingCents: Math.round(Number(f.get("shipping")) * 100),
      expressCents: Math.round(Number(f.get("express")) * 100),
      freeShippingAboveCents: f.get("freeAbove")
        ? Math.round(Number(f.get("freeAbove")) * 100)
        : null,
      reservationMinutes: Number(f.get("minutes")),
      paymentMode: f.get("mode"),
      inventoryDisplay: f.get("inventoryDisplay"),
      defaultSort: f.get("defaultSort"),
      allowPreorder: f.get("allowPreorder") === "on",
      allowBackorder: f.get("allowBackorder") === "on",
      taxMode: f.get("taxMode"),
      shippingMode: f.get("shippingMode"),
      shippingRules: JSON.parse(String(f.get("shippingRules") ?? "[]")),
      taxRegionRates: JSON.parse(String(f.get("taxRegionRates") ?? "{}")),
    });
  }
  function coupon(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void save("/admin/commerce/coupons", {
      code: String(f.get("code")).toUpperCase(),
      market: f.get("market"),
      percentBps: Math.round(Number(f.get("percent")) * 100),
      amountCents: Math.round(Number(f.get("amount")) * 100),
      minimumCents: Math.round(Number(f.get("minimum")) * 100),
      maxUses: f.get("maxUses") ? Number(f.get("maxUses")) : null,
      startsAt: f.get("startsAt")
        ? new Date(String(f.get("startsAt"))).toISOString()
        : null,
      endsAt: f.get("endsAt")
        ? new Date(String(f.get("endsAt"))).toISOString()
        : null,
      active: f.get("active") === "on",
      freeShipping: f.get("freeShipping") === "on",
      productIds: split(f.get("products")),
      userIds: split(f.get("users")),
      perUserLimit: f.get("perUser") ? Number(f.get("perUser")) : null,
    });
  }
  function rule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const scope = String(f.get("scope"));
    void save(
      selectedRule
        ? `/admin/pricing-rules/${selectedRule.id}`
        : "/admin/pricing-rules",
      {
        ...(selectedRule ? {} : { variantId: f.get("variant") }),
        scope,
        ...(scope === "COMPANY_SPECIFIC"
          ? { companyId: f.get("scopeId") }
          : scope === "PRICE_TABLE"
            ? { bookId: f.get("scopeId") }
            : scope === "TIER_LEVEL"
              ? { tierId: f.get("scopeId") }
              : {}),
        priceCents: Math.round(Number(f.get("price")) * 100),
        minQty: Number(f.get("qty")),
        priority: Number(f.get("priority")),
        active: selectedRule?.active ?? true,
        market: f.get("market") || null,
        currency: f.get("currency") || "USD",
        startsAt: f.get("startsAt")
          ? new Date(String(f.get("startsAt"))).toISOString()
          : null,
        endsAt: f.get("endsAt")
          ? new Date(String(f.get("endsAt"))).toISOString()
          : null,
      },
      selectedRule ? "PATCH" : "POST",
    );
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-7xl px-4 py-10"
    >
      <Link href="/admin/dashboard" className="underline text-sm">
        Admin dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Prices, promotions & markets</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Market tax and delivery rates are configurable commercial rules. Confirm
        production tax treatment and payment provider settings before opening
        retail.
      </p>
      {error && (
        <p role="alert" className="mt-4 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 bg-green-50 p-4">
          {notice}
        </p>
      )}
      <label className="mt-5 block max-w-xs">
        Current MFA code
        <input
          className={input}
          inputMode="numeric"
          value={mfa}
          maxLength={6}
          onChange={(e) => setMfa(e.target.value)}
        />
      </label>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Market configuration</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {markets.map((m) => (
            <button
              key={m.code}
              className={button}
              onClick={() => setSelected(m)}
            >
              {m.label} · {m.currency} · {m.retailEnabled ? "Open" : "Closed"}
            </button>
          ))}
          <button className={button} onClick={() => setSelected(null)}>
            New market
          </button>
        </div>
        <form
          key={selected?.code ?? "new"}
          onSubmit={market}
          className="mt-4 grid gap-4 rounded-xl border p-5 sm:grid-cols-3"
        >
          {[
            ["code", "Market code", selected?.code ?? "US"],
            ["label", "Market name", selected?.label ?? "United States"],
            ["currency", "Currency", selected?.currency ?? "USD"],
            [
              "countries",
              "Supported country codes",
              selected?.countries.join(",") ?? "US",
            ],
            ["tax", "Tax rate %", String((selected?.taxBps ?? 0) / 100)],
            [
              "shipping",
              "Standard delivery",
              String((selected?.shippingCents ?? 0) / 100),
            ],
            [
              "express",
              "Express delivery",
              String((selected?.expressCents ?? 0) / 100),
            ],
            [
              "freeAbove",
              "Free standard delivery above",
              selected?.freeShippingAboveCents != null
                ? String(selected.freeShippingAboveCents / 100)
                : "",
            ],
            [
              "minutes",
              "Inventory hold minutes",
              String(selected?.reservationMinutes ?? 30),
            ],
          ].map(([name, label, value]) => (
            <label key={name}>
              {label}
              <input
                className={input}
                name={name}
                defaultValue={value}
                required={name !== "freeAbove"}
              />
            </label>
          ))}
          <label>
            Payment mode
            <select
              className={input}
              name="mode"
              defaultValue={selected?.paymentMode ?? "DEMO"}
            >
              <option value="DEMO">Demo (no money charged)</option>
              <option value="WEBHOOK">Configured payment provider</option>
            </select>
          </label>
          <MarketRulesFields market={selected} />
          <label className="self-center">
            <input
              name="retailEnabled"
              type="checkbox"
              defaultChecked={selected?.retailEnabled ?? true}
            />{" "}
            Retail enabled
          </label>
          <button className={`${button} self-end`} disabled={busy}>
            Save market
          </button>
        </form>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Discount codes</h2>
        <button
          className={`${button} mt-3`}
          onClick={() => setSelectedCoupon(null)}
        >
          New discount code
        </button>
        <form
          id="coupon-editor"
          key={selectedCoupon?.code ?? "new-coupon"}
          onSubmit={coupon}
          className="mt-4 grid gap-4 rounded-xl border p-5 sm:grid-cols-3"
        >
          {[
            ["code", "Code", selectedCoupon?.code ?? ""],
            [
              "percent",
              "Discount %",
              String((selectedCoupon?.percentBps ?? 0) / 100),
            ],
            [
              "amount",
              "Fixed discount amount",
              String((selectedCoupon?.amountCents ?? 0) / 100),
            ],
            [
              "minimum",
              "Minimum order amount",
              String((selectedCoupon?.minimumCents ?? 0) / 100),
            ],
            [
              "maxUses",
              "Maximum total uses",
              String(selectedCoupon?.maxUses ?? ""),
            ],
            [
              "perUser",
              "Maximum uses per customer",
              String(selectedCoupon?.perUserLimit ?? ""),
            ],
            [
              "products",
              "Eligible product IDs (comma separated; blank = all)",
              selectedCoupon?.productIds.join(",") ?? "",
            ],
            [
              "users",
              "Eligible customer IDs (blank = all)",
              selectedCoupon?.userIds.join(",") ?? "",
            ],
          ].map(([name, label, value]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                className={input}
                defaultValue={value}
                required={name === "code"}
                readOnly={name === "code" && !!selectedCoupon}
              />
            </label>
          ))}
          <label>
            Market
            <select
              name="market"
              className={input}
              defaultValue={selectedCoupon?.market}
            >
              {markets.map((m) => (
                <option key={m.code}>{m.code}</option>
              ))}
            </select>
          </label>
          <label>
            Starts at
            <input
              type="datetime-local"
              name="startsAt"
              className={input}
              defaultValue={dateInput(selectedCoupon?.startsAt)}
            />
          </label>
          <label>
            Ends at
            <input
              type="datetime-local"
              name="endsAt"
              className={input}
              defaultValue={dateInput(selectedCoupon?.endsAt)}
            />
          </label>
          <div className="flex gap-4 self-center">
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={selectedCoupon?.active ?? true}
              />{" "}
              Active
            </label>
            <label>
              <input
                name="freeShipping"
                type="checkbox"
                defaultChecked={selectedCoupon?.freeShipping ?? false}
              />{" "}
              Free shipping
            </label>
          </div>
          <button className={button} disabled={busy}>
            Save code
          </button>
        </form>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Code / market</th>
                <th>Discount</th>
                <th>Redemptions</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.code} className="border-b">
                  <td className="py-3">
                    {c.code} / {c.market}
                  </td>
                  <td>
                    {c.percentBps / 100}% + {(c.amountCents / 100).toFixed(2)}{" "}
                    {c.freeShipping ? " · free shipping" : ""}
                  </td>
                  <td>
                    {c.uses} / {c.maxUses ?? "unlimited"}
                  </td>
                  <td>{c.active ? "Active" : "Paused"}</td>
                  <td>
                    <a
                      href="#coupon-editor"
                      className={button}
                      onClick={() => setSelectedCoupon(c)}
                    >
                      Edit
                    </a>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void save("/admin/commerce/coupons", {
                          code: c.code,
                          market: c.market,
                          percentBps: c.percentBps,
                          amountCents: c.amountCents,
                          minimumCents: c.minimumCents,
                          active: !c.active,
                          freeShipping: c.freeShipping,
                          productIds: c.productIds,
                          userIds: c.userIds,
                        })
                      }
                    >
                      {c.active ? "Pause" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Dealer price rules</h2>
        <button
          className={`${button} mt-3`}
          onClick={() => setSelectedRule(null)}
        >
          New price rule
        </button>
        <form
          id="rule-editor"
          key={selectedRule?.id ?? "new-rule"}
          onSubmit={rule}
          className="mt-4 grid gap-4 rounded-xl border p-5 sm:grid-cols-3"
        >
          {[
            ["variant", "Variant ID", selectedRule?.variantId ?? ""],
            [
              "scopeId",
              "Company / book / tier ID",
              selectedRule?.companyId ??
                selectedRule?.bookId ??
                selectedRule?.tierId ??
                "",
            ],
            [
              "price",
              "Unit price",
              selectedRule ? String(selectedRule.priceCents / 100) : "",
            ],
            ["qty", "Minimum quantity", String(selectedRule?.minQty ?? 1)],
            ["priority", "Priority", String(selectedRule?.priority ?? 0)],
            ["market", "Market (blank = all)", selectedRule?.market ?? ""],
            ["currency", "Currency", selectedRule?.currency ?? "USD"],
          ].map(([name, label, value]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                className={input}
                defaultValue={value}
                required={["variant", "price"].includes(name)}
                readOnly={name === "variant" && !!selectedRule}
              />
            </label>
          ))}
          <label>
            Scope
            <select
              className={input}
              name="scope"
              defaultValue={selectedRule?.scope ?? "B2B_DEFAULT"}
            >
              {[
                "COMPANY_SPECIFIC",
                "PRICE_TABLE",
                "TIER_LEVEL",
                "B2B_DEFAULT",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Starts at
            <input
              name="startsAt"
              type="datetime-local"
              className={input}
              defaultValue={dateInput(selectedRule?.startsAt)}
            />
          </label>
          <label>
            Ends at
            <input
              name="endsAt"
              type="datetime-local"
              className={input}
              defaultValue={dateInput(selectedRule?.endsAt)}
            />
          </label>
          <button className={`${button} self-end`} disabled={busy}>
            {selectedRule ? "Save price rule" : "Create rule"}
          </button>
        </form>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Variant / scope</th>
                <th>Price</th>
                <th>MOQ</th>
                <th>Window</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-3">
                    {r.variantId}
                    <br />
                    {r.scope}
                  </td>
                  <td>
                    {r.currency} {(r.priceCents / 100).toFixed(2)}
                  </td>
                  <td>{r.minQty}</td>
                  <td>
                    {r.startsAt?.slice(0, 10) ?? "Any"} –{" "}
                    {r.endsAt?.slice(0, 10) ?? "Any"}
                  </td>
                  <td>
                    <a
                      href="#rule-editor"
                      className={button}
                      onClick={() => setSelectedRule(r)}
                    >
                      Edit
                    </a>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void save(
                          `/admin/pricing-rules/${r.id}`,
                          { active: !r.active },
                          "PATCH",
                        )
                      }
                    >
                      {r.active ? "Pause" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

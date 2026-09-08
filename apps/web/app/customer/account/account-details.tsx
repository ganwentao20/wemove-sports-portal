"use client";
import { uiError } from "../../../lib/ui-i18n";

import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { languageName } from "../../../lib/language-code";
import { secureApiFetch } from "../../../lib/secure-api";
import { AccountSecurity } from "../../../components/account-security";
type Profile = {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  country: string | null;
  productUpdates: boolean;
  phone: string | null;
  locale: string;
  marketingEmail: boolean;
  marketingSms: boolean;
  mfaEnabled: boolean;
};
type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  postalCode: string;
  line1: string;
  line2: string;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
};
type Favorite = {
  id: string;
  productId: string;
  product: {
    name: string;
    slug: string;
    variants: { id: string; sku: string; name: string | null }[];
  } | null;
};
type Privacy = {
  id: string;
  status: string;
  reason: string;
  resolution: string | null;
  createdAt: string;
};
const input = "mt-1 w-full rounded-lg border p-2";
const button = "rounded-lg border px-4 py-2 font-medium disabled:opacity-50";
const addressFields = [
  ["label", "Address label"],
  ["recipient", "Recipient"],
  ["phone", "Phone"],
  ["country", "Country (two-letter code)"],
  ["region", "State / region"],
  ["city", "City"],
  ["postalCode", "Postal code"],
  ["line1", "Street address"],
  ["line2", "Apartment / suite"],
] as const;
export function AccountDetails() {
  const uiLocale = useUiLocale();

  const t = useUiText();

  const [languages, setLanguages] = useState<string[]>(["en", "zh"]);
  useEffect(() => {
    void apiFetch<{ locale: { languages: string[] } }>("/site/config")
      .then((config) => setLanguages(config.locale.languages))
      .catch(() => undefined);
  }, []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [requests, setRequests] = useState<Privacy[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const load = useCallback(async () => {
    const [p, a, f, r] = await Promise.all([
      secureApiFetch<Profile>("customer", "/account/profile"),
      secureApiFetch<Address[]>("customer", "/account/addresses"),
      secureApiFetch<Favorite[]>(
        "customer",
        `/account/favorites?locale=${encodeURIComponent(uiLocale)}`,
      ),
      secureApiFetch<Privacy[]>("customer", "/account/privacy-requests"),
    ]);
    setProfile(p);
    setAddresses(a);
    setFavorites(f);
    setRequests(r);
  }, [uiLocale]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function run(work: () => Promise<void>, message = "Saved.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await run(async () => {
      await secureApiFetch("customer", "/account/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: d.get("name"),
          displayName: d.get("displayName"),
          country: String(d.get("country") ?? "").toUpperCase(),
          productUpdates: d.has("productUpdates"),
          phone: d.get("phone"),
          locale: d.get("locale"),
          marketingEmail: d.has("marketingEmail"),
          marketingSms: d.has("marketingSms"),
        }),
      });
    });
  }
  async function saveAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await run(async () => {
      await secureApiFetch(
        "customer",
        `/account/addresses${editing ? `/${editing.id}` : ""}`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            ...Object.fromEntries(d),
            country: String(d.get("country")).toUpperCase(),
            isDefaultBilling: d.has("isDefaultBilling"),
            isDefaultShipping: d.has("isDefaultShipping"),
          }),
        },
      );
      setEditing(null);
      setFormKey((v) => v + 1);
    });
  }
  return (
    <div className="mt-6 space-y-6">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error ? uiError(uiLocale, error) : ""}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3">
          {notice ? uiError(uiLocale, notice) : ""}
        </p>
      )}
      {profile && (
        <section className="rounded-2xl border p-5">
          <h2 className="text-xl font-semibold">
            {t("Profile and subscriptions")}
          </h2>
          <form
            key={`${profile.name}-${profile.locale}`}
            onSubmit={saveProfile}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <label>
              {t("Name")}
              <input
                name="name"
                defaultValue={profile.name}
                minLength={2}
                maxLength={60}
                required
                className={input}
              />
            </label>
            <label>
              {t("Display name")}
              <input
                name="displayName"
                defaultValue={profile.displayName ?? ""}
                maxLength={60}
                className={input}
              />
            </label>
            <label>
              {t("Country / region")}
              <input
                name="country"
                defaultValue={profile.country ?? ""}
                pattern="[A-Za-z]{2}"
                maxLength={2}
                className={input}
              />
            </label>
            <label>
              {t("Phone")}
              <input
                name="phone"
                defaultValue={profile.phone ?? ""}
                maxLength={40}
                className={input}
              />
            </label>
            <label>
              {t("Email language")}
              <select
                name="locale"
                defaultValue={profile.locale}
                className={input}
              >
                {[...new Set([...languages, profile.locale])].map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </label>
            <p className="self-center text-sm">
              {t("Email:")} {profile.email}
            </p>
            <label className="flex gap-2">
              <input
                type="checkbox"
                name="marketingEmail"
                defaultChecked={profile.marketingEmail}
              />{" "}
              {t("Email offers and news")}
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                name="marketingSms"
                defaultChecked={profile.marketingSms}
              />{" "}
              {t("SMS offers and news")}
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                name="productUpdates"
                defaultChecked={profile.productUpdates}
              />{" "}
              {t("Product updates")}
            </label>
            <button disabled={busy} className={button}>
              {t("Save profile")}
            </button>
          </form>
        </section>
      )}
      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold">{t("Address book")}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg bg-neutral-50 p-4">
              <h3 className="font-semibold">{a.label}</h3>
              <p>
                {a.recipient} · {a.phone}
              </p>
              <p>
                {a.line1} {a.line2}, {a.city}, {a.region} {a.postalCode},{" "}
                {a.country}
              </p>
              <p className="text-sm">
                {a.isDefaultShipping && t("Default shipping ")}
                {a.isDefaultBilling && t("Default billing")}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  className={button}
                  onClick={() => {
                    setEditing(a);
                    setFormKey((v) => v + 1);
                  }}
                >
                  {t("Edit")}
                </button>
                <button
                  disabled={busy}
                  className={button}
                  onClick={() =>
                    void run(async () => {
                      await secureApiFetch(
                        "customer",
                        `/account/addresses/${a.id}`,
                        { method: "DELETE" },
                      );
                    })
                  }
                >
                  {t("Delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form
          key={formKey}
          onSubmit={saveAddress}
          className="mt-5 grid gap-3 sm:grid-cols-2"
        >
          <h3 className="font-semibold sm:col-span-2">
            {editing ? t("Edit address") : t("Add an address")}
          </h3>
          {addressFields.map(([key, label]) => (
            <label key={key}>
              {t(String(label))}
              <input
                name={key}
                defaultValue={editing?.[key] ?? ""}
                required={key !== "line2" && key !== "region"}
                maxLength={key === "country" ? 2 : 200}
                className={input}
              />
            </label>
          ))}
          <label className="flex gap-2 items-center">
            <input
              name="isDefaultShipping"
              type="checkbox"
              defaultChecked={editing?.isDefaultShipping}
            />{" "}
            {t("Default shipping")}
          </label>
          <label className="flex gap-2 items-center">
            <input
              name="isDefaultBilling"
              type="checkbox"
              defaultChecked={editing?.isDefaultBilling}
            />{" "}
            {t("Default billing")}
          </label>
          <div className="flex gap-3">
            <button disabled={busy} className={button}>
              {t("Save address")}
            </button>
            {editing && (
              <button
                type="button"
                className={button}
                onClick={() => {
                  setEditing(null);
                  setFormKey((v) => v + 1);
                }}
              >
                {t("Cancel")}
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold">{t("Wishlist")}</h2>
        {!favorites.length && (
          <p className="mt-3">
            {t("Save products using the wishlist button on a product page.")}
          </p>
        )}
        <ul className="divide-y">
          {favorites.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between py-3 gap-3"
            >
              {f.product ? (
                <Link
                  className="underline"
                  href={`/products/${f.product.slug}`}
                >
                  {f.product.name}
                </Link>
              ) : (
                <span>{t("Product unavailable")}</span>
              )}
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  void run(async () => {
                    await secureApiFetch(
                      "customer",
                      `/account/favorites/${f.productId}`,
                      { method: "DELETE" },
                    );
                  })
                }
              >
                {t("Remove")}
              </button>
              {f.product && f.product.variants.length > 0 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void run(async () => {
                      await secureApiFetch("customer", "/cart/items", {
                        method: "POST",
                        body: JSON.stringify({
                          variantId: d.get("variantId"),
                          quantity: 1,
                        }),
                      });
                    }, "Added to cart. Open checkout to continue.");
                  }}
                  className="flex flex-wrap items-end gap-2"
                >
                  <label className="text-sm">
                    {t("Variant")}
                    <select name="variantId" className={input}>
                      {f.product.variants.map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.name ?? v.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={busy} className={button}>
                    {t("Add to cart")}
                  </button>
                  <Link href="/checkout" className="underline text-sm">
                    {t("Checkout")}
                  </Link>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
      {profile && <AccountSecurity mfaEnabled={profile.mfaEnabled} />}
      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold">{t("Your data")}</h2>
        <p className="my-3 text-sm">
          {t(
            "Download your profile, addresses, orders, preferences and requests. Deletion requests are reviewed by support; open orders and company memberships must be closed or transferred. Commercial records required for fulfillment and accounting may be retained.",
          )}
        </p>
        <button
          disabled={busy}
          className={button}
          onClick={() =>
            void run(async () => {
              const data = await secureApiFetch("customer", "/account/export");
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "wemove-account-data.json";
              a.click();
              URL.revokeObjectURL(url);
            }, "Data export downloaded.")
          }
        >
          {t("Download my data")}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            void run(async () => {
              await secureApiFetch("customer", "/account/deletion-request", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(d)),
              });
            }, "Deletion request received. Track the response below.");
          }}
          className="mt-5 grid gap-3 sm:grid-cols-2"
        >
          <label>
            {t("Reason for deleting your account")}
            <textarea
              name="reason"
              minLength={5}
              maxLength={1000}
              required
              className={input}
            />
          </label>
          <label>
            {t("Confirm current password")}
            <input
              name="password"
              autoComplete="current-password"
              type="password"
              required
              className={input}
            />
          </label>
          <button disabled={busy} className={button}>
            {t("Request account deletion")}
          </button>
        </form>
        <ul className="mt-4 divide-y">
          {requests.map((r) => (
            <li key={r.id} className="py-3">
              <p>
                {t(r.status)} ·{" "}
                {new Date(r.createdAt).toLocaleDateString(uiLocale)}
              </p>
              <p>{r.reason}</p>
              {r.resolution && (
                <p>
                  {t("Support:")} {r.resolution}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

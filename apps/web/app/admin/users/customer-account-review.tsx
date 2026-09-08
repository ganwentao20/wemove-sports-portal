"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { useState } from "react";
import Link from "next/link";
import { secureApiFetch } from "../../../lib/secure-api";
type Review = {
  profile: {
    name: string;
    email: string;
    phone: string | null;
    displayName: string | null;
    country: string | null;
    locale: string;
    status: string;
    marketingEmail: boolean;
    marketingSms: boolean;
    productUpdates: boolean;
    termsVersion: string | null;
    privacyVersion: string | null;
    policiesAgreedAt: string | null;
  };
  addresses: Array<{
    id: string;
    label: string;
    recipient: string;
    phone: string;
    country: string;
    city: string;
    region: string;
    postalCode: string;
    line1: string;
    line2: string | null;
  }>;
  orders: Array<{
    id: string;
    orderNo: string;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  subscription: { status: string; locale: string; updatedAt: string } | null;
};
export function CustomerAccountReview({
  id,
  canWrite,
  code,
}: {
  id: string;
  canWrite: boolean;
  code: string;
}) {
  const t = useUiText();
  const uiLocale = useUiLocale();

  const [data, setData] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await secureApiFetch<Review>("staff", `/admin/users/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load customer");
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await secureApiFetch("staff", `/admin/users/${id}/password-reset`, {
        method: "POST",
        headers: { "x-mfa-code": code },
        body: "{}",
      });
      setNotice(
        "A password reset email was requested. The customer chooses their own new password.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="w-full rounded-lg border p-3"
      onToggle={(e) => {
        if (e.currentTarget.open && !data && !busy) void load();
      }}
    >
      <summary className="cursor-pointer font-medium">
        {t("Profile, addresses and orders")}
      </summary>
      {busy && (
        <p role="status" className="mt-3">
          {t("Loading…")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-700">
          {error ? uiError(uiLocale, error) : ""}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-emerald-800">
          {notice ? uiError(uiLocale, notice) : ""}
        </p>
      )}
      {data && (
        <div className="mt-4 space-y-5 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">{t("Contact")}</dt>
              <dd>
                {data.profile.email} · {data.profile.phone || t("No phone")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t("Profile")}</dt>
              <dd>
                {data.profile.name} ·{" "}
                {data.profile.displayName || t("No display name")} ·{" "}
                {data.profile.country || t("No country")} ·{" "}
                {data.profile.locale}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t("Email verification")}</dt>
              <dd>
                {data.profile.status === "PENDING"
                  ? t("Awaiting verification")
                  : t("Email verified")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t("Preferences")}</dt>
              <dd>
                {t("Email offers:")}
                {data.profile.marketingEmail ? t("yes") : t("no")}
                {t("; SMS:")} {data.profile.marketingSms ? t("yes") : t("no")}
                {t("; product updates:")}{" "}
                {data.profile.productUpdates ? t("yes") : t("no")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t("Newsletter")}</dt>
              <dd>{data.subscription?.status || t("Not subscribed")}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t("Policy consent")}</dt>
              <dd>
                {data.profile.termsVersion || t("Not recorded")} /{" "}
                {data.profile.privacyVersion || t("Not recorded")}
                {data.profile.policiesAgreedAt &&
                  ` · ${new Date(data.profile.policiesAgreedAt).toLocaleString(uiLocale === "zh" ? "zh-CN" : "en-US")}`}
              </dd>
            </div>
          </dl>
          <section>
            <h3 className="font-semibold">{t("Addresses")}</h3>
            {data.addresses.length ? (
              data.addresses.map((a) => (
                <address key={a.id} className="mt-2 border-l-2 pl-3 not-italic">
                  {a.label} — {a.recipient}, {a.phone}
                  <br />
                  {a.line1} {a.line2}, {a.city} {a.region} {a.postalCode},{" "}
                  {a.country}
                </address>
              ))
            ) : (
              <p>{t("No saved addresses.")}</p>
            )}
          </section>
          <section>
            <h3 className="font-semibold">{t("Recent orders (up to 100)")}</h3>
            {data.orders.length ? (
              <ul className="mt-2 space-y-2">
                {data.orders.map((o) => (
                  <li key={o.id}>
                    <Link className="underline" href={`/admin/orders/${o.id}`}>
                      {o.orderNo}
                    </Link>{" "}
                    · {t(String(o.status))} · {t(String(o.paymentStatus))} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString(
                      uiLocale === "zh" ? "zh-CN" : "en-US",
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t("No orders.")}</p>
            )}
          </section>
          {canWrite && data.profile.status === "ACTIVE" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void reset()}
              className="rounded-lg border px-3 py-2 font-medium disabled:opacity-50"
            >
              {t("Send password reset email")}
            </button>
          )}
        </div>
      )}
    </details>
  );
}

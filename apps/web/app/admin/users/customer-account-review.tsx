"use client";
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
        Profile, addresses and orders
      </summary>
      {busy && (
        <p role="status" className="mt-3">
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-emerald-800">
          {notice}
        </p>
      )}
      {data && (
        <div className="mt-4 space-y-5 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Contact</dt>
              <dd>
                {data.profile.email} · {data.profile.phone || "No phone"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Profile</dt>
              <dd>
                {data.profile.name} ·{" "}
                {data.profile.displayName || "No display name"} ·{" "}
                {data.profile.country || "No country"} · {data.profile.locale}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Email verification</dt>
              <dd>
                {data.profile.status === "PENDING"
                  ? "Awaiting verification"
                  : "Email verified"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Preferences</dt>
              <dd>
                Email offers: {data.profile.marketingEmail ? "yes" : "no"}; SMS:{" "}
                {data.profile.marketingSms ? "yes" : "no"}; product updates:{" "}
                {data.profile.productUpdates ? "yes" : "no"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Newsletter</dt>
              <dd>{data.subscription?.status || "Not subscribed"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Policy consent</dt>
              <dd>
                {data.profile.termsVersion || "Not recorded"} /{" "}
                {data.profile.privacyVersion || "Not recorded"}
                {data.profile.policiesAgreedAt &&
                  ` · ${new Date(data.profile.policiesAgreedAt).toLocaleString()}`}
              </dd>
            </div>
          </dl>
          <section>
            <h3 className="font-semibold">Addresses</h3>
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
              <p>No saved addresses.</p>
            )}
          </section>
          <section>
            <h3 className="font-semibold">Recent orders (up to 100)</h3>
            {data.orders.length ? (
              <ul className="mt-2 space-y-2">
                {data.orders.map((o) => (
                  <li key={o.id}>
                    <Link className="underline" href={`/admin/orders/${o.id}`}>
                      {o.orderNo}
                    </Link>{" "}
                    · {o.status} · {o.paymentStatus} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No orders.</p>
            )}
          </section>
          {canWrite && data.profile.status === "ACTIVE" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void reset()}
              className="rounded-lg border px-3 py-2 font-medium disabled:opacity-50"
            >
              Send password reset email
            </button>
          )}
        </div>
      )}
    </details>
  );
}

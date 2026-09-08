"use client";
import { uiError } from "../../../lib/ui-i18n";

import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { DirectoryProfileFields } from "../../../components/directory-profile-fields";
import { secureApiFetch } from "../../../lib/secure-api";
type Overview = {
  company: {
    companyName: string;
    role: string;
    profile: Record<string, any>;
  };
  members: Array<{
    userId: string;
    role: string;
    active: boolean;
    user: { name: string; email: string };
  }>;
  addresses: Array<{
    id: string;
    label: string;
    kind: string;
    address: Record<string, string>;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
  }>;
};
const input = "mt-1 w-full rounded border border-neutral-300 p-2";
const button =
  "rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50";
export function CompanyWorkbench({
  admin = false,
  companyId = "",
}: { admin?: boolean; companyId?: string } = {}) {
  const uiLocale = useUiLocale();

  const t = useUiText();

  const kind = admin ? "staff" : "dealer";
  const base = admin
    ? `/admin/b2b/companies/${encodeURIComponent(companyId)}`
    : "/dealer/company";
  const [mfa, setMfa] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState("");
  const [editingAddress, setEditingAddress] = useState<
    Overview["addresses"][number] | null
  >(null);
  const load = useCallback(
    async () => setData(await secureApiFetch<Overview>(kind, base)),
    [kind, base],
  );
  useEffect(() => {
    setInvitation(
      new URLSearchParams(location.hash.slice(1)).get("invitation") ?? "",
    );
    void load().catch((e) => setNotice(e.message));
  }, [load]);
  async function act(path: string, body: unknown, method = "POST") {
    if (admin && !/^\d{6}$/.test(mfa)) {
      setNotice("Enter the current six-digit MFA code.");
      return;
    }
    setBusy(true);
    try {
      await secureApiFetch(
        kind,
        admin ? base + path.slice("/dealer/company".length) : path,
        {
          method,
          headers: admin ? { "x-mfa-code": mfa } : undefined,
          body: JSON.stringify(body),
        },
      );
      setNotice("Saved.");
      setMfa("");
      await load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function profile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p: Record<string, unknown> = { ...data?.company.profile };
    for (const k of [
      "displayName",
      "taxId",
      "businessType",
      "salesRegion",
      "salesRepresentative",
      "phone",
      "website",
      "city",
      "publicAddress",
      "salesContact",
      "publicPhone",
      "publicLogo",
      "publicRegion",
      "publicPostalCode",
      "publicHours",
      "publicDescription",
    ])
      p[k] = String(f.get(k) ?? "");
    p.publicListing = f.get("publicListing") === "on";
    for (const key of ["publicDetail", "onlineStore", "physicalStore"])
      p[key] = f.get(key) === "on";
    for (const k of ["latitude", "longitude"])
      p[k] = f.get(k) ? Number(f.get(k)) : null;
    await act(
      "/dealer/company",
      { companyName: f.get("companyName"), profile: p },
      "PATCH",
    );
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl space-y-6 px-4 py-10"
    >
      <Link
        href={admin ? "/admin/b2b" : "/dealer/dashboard"}
        className="underline"
      >
        {admin ? t("B2B administration") : t("Dealer dashboard")}
      </Link>
      <h1 className="text-3xl font-bold">{t("Company, team & addresses")}</h1>
      <p role="status">{notice ? uiError(uiLocale, notice) : ""}</p>
      {admin && (
        <label>
          {t("Current MFA code")}
          <input
            className={input}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfa}
            onChange={(e) =>
              setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </label>
      )}
      {!admin && (
        <form
          className="rounded border p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await secureApiFetch("customer", "/dealer/invitations/accept", {
                method: "POST",
                body: JSON.stringify({ token: invitation }),
              });
              setNotice(
                "Invitation accepted. Sign in at Dealer login to activate the company session.",
              );
              setInvitation("");
            } catch (err) {
              setNotice((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("Invitation token")}
            <input
              className={input}
              value={invitation}
              onChange={(e) => setInvitation(e.target.value)}
              minLength={64}
              maxLength={64}
            />
          </label>
          <p className="my-2 text-sm">
            {t("Use a verified customer account with the invited email.")}{" "}
            <Link href="/customer/login" className="underline">
              {t("Customer login")}
            </Link>
          </p>
          <button
            className={button}
            disabled={busy || invitation.length !== 64}
          >
            {t("Accept invitation")}
          </button>
        </form>
      )}
      {data && (
        <>
          <section className="rounded border p-5">
            <h2 className="text-xl font-semibold">{t("Company profile")}</h2>
            <form onSubmit={profile} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                {t("Company name")}
                <input
                  name="companyName"
                  className={input}
                  defaultValue={data.company.companyName}
                  required
                />
              </label>
              {[
                "displayName",
                "taxId",
                "businessType",
                "salesRegion",
                "salesRepresentative",
                "phone",
                "website",
                "city",
                "publicAddress",
                "salesContact",
                "latitude",
                "longitude",
              ].map((k) => (
                <label key={k}>
                  {t(k)}
                  <input
                    name={k}
                    className={input}
                    defaultValue={String(data.company.profile[k] ?? "")}
                  />
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  name="publicListing"
                  defaultChecked={data.company.profile.publicListing === true}
                />{" "}
                {t("Publish store in dealer directory")}
              </label>
              <DirectoryProfileFields
                profile={data.company.profile}
                admin={admin}
                onReview={(approve, reason, submissionId) =>
                  act("/dealer/company/directory-review", {
                    approve,
                    reason,
                    submissionId,
                  })
                }
              />
              {data.company.role === "OWNER" && (
                <button disabled={busy} className={button}>
                  {t("Save profile")}
                </button>
              )}
            </form>
          </section>
          <section className="rounded border p-5">
            <h2 className="text-xl font-semibold">{t("Team")}</h2>
            {data.members.map((m) => (
              <form
                className="my-4 flex flex-wrap items-end gap-3 rounded bg-neutral-50 p-3"
                key={m.userId}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(
                    `/dealer/company/members/${m.userId}`,
                    { role: f.get("role"), active: f.get("active") === "on" },
                    "PATCH",
                  );
                }}
              >
                <p className="min-w-0 break-all">
                  {m.user.name} · {m.user.email}
                </p>
                <label>
                  {t("Role")}
                  <select name="role" defaultValue={m.role} className={input}>
                    {["OWNER", "BUYER", "VIEWER"].map((r) => (
                      <option key={r} value={r}>
                        {t(r)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={m.active}
                  />{" "}
                  {t("Active")}
                </label>
                {data.company.role === "OWNER" && (
                  <button className={button} disabled={busy}>
                    {t("Update member")}
                  </button>
                )}
              </form>
            ))}
            {data.company.role === "OWNER" && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    "/dealer/company/invitations",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                <label>
                  {t("Invite email")}
                  <input name="email" type="email" required className={input} />
                </label>
                <label>
                  {t("Role")}
                  <select name="role" className={input}>
                    <option value={"BUYER"}>{t("BUYER")}</option>
                    <option value={"VIEWER"}>{t("VIEWER")}</option>
                  </select>
                </label>
                <button className={button} disabled={busy}>
                  {t("Send invitation")}
                </button>
              </form>
            )}
            {data.invitations.map((i) => (
              <p key={i.id} className="mt-2 text-sm">
                {t("Pending:")} {i.email} ({t(i.role)} {t(") · expires")}{" "}
                {new Date(i.expiresAt).toLocaleDateString(uiLocale)}
              </p>
            ))}
          </section>
          <section className="rounded border p-5">
            <h2 className="text-xl font-semibold">
              {t("Company address book")}
            </h2>
            {data.addresses.map((a) => (
              <div key={a.id} className="my-4 rounded bg-neutral-50 p-3">
                <strong>
                  {a.label} ({t(a.kind)})
                </strong>
                <p>{Object.values(a.address).join(", ")}</p>
                <p className="text-xs">
                  {data.company.profile.defaultShippingAddressId === a.id
                    ? t("Default shipping address · ")
                    : ""}
                  {data.company.profile.defaultBillingAddressId === a.id
                    ? t("Default billing address")
                    : ""}
                </p>
                {data.company.role === "OWNER" && (
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setEditingAddress(a)}
                    >
                      {t("Edit address")}
                    </button>
                    {(["SHIPPING", "BILLING"] as const)
                      .filter((use) => a.kind === "BOTH" || a.kind === use)
                      .map((use) => (
                        <button
                          key={use}
                          disabled={busy}
                          className="underline"
                          onClick={() =>
                            void act(
                              "/dealer/company",
                              {
                                companyName: data.company.companyName,
                                profile: {
                                  ...data.company.profile,
                                  [use === "SHIPPING"
                                    ? "defaultShippingAddressId"
                                    : "defaultBillingAddressId"]: a.id,
                                },
                              },
                              "PATCH",
                            )
                          }
                        >
                          {t("Use as default")} {t(use)}
                        </button>
                      ))}
                  </div>
                )}
                {data.company.role === "OWNER" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(
                        `/dealer/company/addresses/${a.id}`,
                        {},
                        "DELETE",
                      )
                    }
                    className="mt-2 underline"
                  >
                    {t("Remove address")}
                  </button>
                )}
              </div>
            ))}
            {data.company.role === "OWNER" && (
              <form
                key={editingAddress?.id ?? "new-address"}
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  const { label, kind, ...address } = f;
                  void act(
                    `/dealer/company/addresses${editingAddress ? `/${editingAddress.id}` : ""}`,
                    {
                      label,
                      kind,
                      address,
                    },
                    editingAddress ? "PUT" : "POST",
                  );
                }}
              >
                <label>
                  {t("Address label")}
                  <input
                    className={input}
                    name="label"
                    defaultValue={editingAddress?.label ?? ""}
                    required
                  />
                </label>
                <label>
                  {t("Use")}
                  <select
                    className={input}
                    name="kind"
                    defaultValue={editingAddress?.kind ?? "BOTH"}
                  >
                    <option value={"BOTH"}>{t("BOTH")}</option>
                    <option value={"HEADQUARTERS"}>{t("HEADQUARTERS")}</option>
                    <option value={"SHIPPING"}>{t("SHIPPING")}</option>
                    <option value={"BILLING"}>{t("BILLING")}</option>
                  </select>
                </label>
                {[
                  "recipient",
                  "phone",
                  "country",
                  "city",
                  "addressLine",
                  "postalCode",
                ].map((k) => (
                  <label key={k}>
                    {t(k)}
                    <input
                      className={input}
                      name={k}
                      defaultValue={editingAddress?.address[k] ?? ""}
                      required
                      maxLength={k === "country" ? 2 : 200}
                    />
                  </label>
                ))}
                <button className={button} disabled={busy}>
                  {editingAddress
                    ? t("Save address changes")
                    : t("Add company address")}
                </button>
                {editingAddress && (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setEditingAddress(null)}
                  >
                    {t("Add another address")}
                  </button>
                )}
              </form>
            )}
          </section>
          <section className="rounded border p-5">
            <h2 className="text-xl font-semibold">{t("Dealer support")}</h2>
            <p>
              {String(
                data.company.profile.salesContact ??
                  t(
                    "Contact the sales team for account and procurement assistance.",
                  ),
              )}
            </p>
            <Link className="underline" href="/contact?source=dealer">
              {t("Open a support request")}
            </Link>
          </section>
        </>
      )}
    </main>
  );
}

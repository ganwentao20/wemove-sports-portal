"use client";
import { RedirectImport } from "./redirect-import";
import Link from "next/link";
import { BrandSocialLinks } from "./brand-social-links";
import { NavigationSettings } from "./navigation-settings";
import { LocaleSettings } from "./locale-settings";
import { OperationMetrics } from "./operation-metrics";
import { useEffect, useState } from "react";
import { secureApiFetch } from "../lib/secure-api";
type Data = Record<string, any>;
const inputClass = "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2";
export function PlatformWorkbench({
  section,
}: {
  section: "settings" | "reports" | "seo";
}) {
  const [data, setData] = useState<Data>({}),
    [message, setMessage] = useState(""),
    [mfa, setMfa] = useState(""),
    [redirects, setRedirects] = useState<
      Array<{ id: string; source: string; destination: string; status: number }>
    >([]),
    [mail, setMail] = useState<
      Array<{
        id: string;
        kind: string;
        status: string;
        attempts: number;
        createdAt: string;
      }>
    >([]),
    [busy, setBusy] = useState(false);
  const path = section === "seo" ? "/admin/seo/audit" : `/admin/${section}`;
  async function load() {
    try {
      setData(await secureApiFetch("staff", path));
      if (section === "seo")
        setRedirects(await secureApiFetch("staff", "/admin/seo/redirects"));
      if (section === "settings")
        setMail(await secureApiFetch("staff", "/admin/notifications"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load");
    }
  }
  useEffect(() => {
    void load();
  }, [section]);
  async function save(key: string, value: unknown) {
    setBusy(true);
    try {
      await secureApiFetch("staff", `/admin/settings/${key}`, {
        method: "PUT",
        headers: { "x-mfa-code": mfa },
        body: JSON.stringify({ value }),
      });
      setMessage("Settings saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  const title = {
    settings: "Site settings",
    reports: "Operations reports",
    seo: "Search visibility",
  }[section];
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <Link href="/admin/dashboard" className="underline">
        Operations dashboard
      </Link>
      <div className="my-6 flex flex-wrap justify-between gap-4">
        <h1 className="text-3xl font-bold">{title}</h1>
        <label>
          MFA code
          <input
            value={mfa}
            onChange={(e) => setMfa(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            className="ml-2 w-28 rounded border p-2"
          />
        </label>
      </div>
      <p role="status" className="mb-4">
        {message}
      </p>
      {section === "settings" && data.brand && (
        <div className="space-y-6">
          <form
            className="rounded-xl border p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save("brand", data.brand);
            }}
          >
            <h2 className="text-xl font-bold">Brand and contact</h2>
            <div className="my-4 grid gap-4 sm:grid-cols-2">
              {[
                "name",
                "logo",
                "favicon",
                "primaryColor",
                "contactEmail",
                "contactPhone",
                "address",
              ].map((key) => (
                <label key={key}>
                  {key}
                  <input
                    className={inputClass}
                    value={data.brand[key] ?? ""}
                    onChange={(e) =>
                      setData({
                        ...data,
                        brand: { ...data.brand, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <BrandSocialLinks
              value={data.brand.socials ?? []}
              onChange={(socials) =>
                setData({ ...data, brand: { ...data.brand, socials } })
              }
            />
            <button disabled={busy} className="rounded-lg border px-4 py-2">
              Save brand
            </button>
          </form>
          <section className="rounded-xl border p-5">
            <h2 className="text-xl font-bold">Navigation</h2>
            <p className="my-3 text-sm">
              Arrange primary and secondary links, translate their labels and
              choose available markets.
            </p>
            <NavigationSettings
              items={data.navigation?.items ?? []}
              languages={data.locale?.languages ?? ["en", "zh"]}
              onChange={(items) =>
                setData({ ...data, navigation: { ...data.navigation, items } })
              }
            />
            <button
              disabled={busy}
              onClick={() => void save("navigation", data.navigation)}
              className="mt-4 rounded border px-4 py-2"
            >
              Save navigation
            </button>
          </section>
          <form
            className="rounded-xl border p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save("search", data.search);
            }}
          >
            <h2 className="mb-4 text-xl font-bold">Search synonyms</h2>
            <label>
              One group per line: preferred phrase = alternative, alternative
              <textarea
                rows={6}
                className={inputClass}
                value={Object.entries(data.search?.synonyms ?? {})
                  .map(
                    ([key, value]) =>
                      `${key} = ${(value as string[]).join(", ")}`,
                  )
                  .join("\n")}
                onChange={(e) =>
                  setData({
                    ...data,
                    search: {
                      synonyms: Object.fromEntries(
                        e.target.value
                          .split("\n")
                          .map((line) => {
                            const [key, ...values] = line.split("=");
                            return [
                              key.trim(),
                              values
                                .join("=")
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean),
                            ];
                          })
                          .filter(([key]) => Boolean(key)),
                      ),
                    },
                  })
                }
              />
            </label>
            <button disabled={busy} className="mt-3 rounded border px-4 py-2">
              Save synonyms
            </button>
          </form>
          <form
            className="rounded-xl border p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save("notifications", data.notifications);
            }}
          >
            <h2 className="mb-3 text-xl font-bold">
              Internal notification groups
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {["dealer", "support", "orders"].map((key) => (
                <label key={key}>
                  {key} (comma separated emails)
                  <input
                    value={(data.notifications?.[key] ?? []).join(", ")}
                    onChange={(e) =>
                      setData({
                        ...data,
                        notifications: {
                          ...data.notifications,
                          [key]: e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
            <button disabled={busy} className="mt-4 rounded border px-4 py-2">
              Save recipients
            </button>
          </form>
          <LocaleSettings
            value={data.locale}
            busy={busy}
            onSave={(value) => void save("locale", value)}
          />
          <section className="rounded-xl border p-5">
            <h2 className="mb-3 text-xl font-bold">Analytics</h2>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={data.tracking?.enabled === true}
                onChange={(e) =>
                  setData({
                    ...data,
                    tracking: { ...data.tracking, enabled: e.target.checked },
                  })
                }
              />
              Enable analytics after visitor consent
            </label>
            <button
              onClick={() => void save("tracking", data.tracking)}
              className="mt-3 rounded border px-4 py-2"
            >
              Save analytics
            </button>
          </section>
          <section className="rounded-xl border p-5">
            <h2 className="mb-4 text-xl font-bold">Email deliveries</h2>
            <Link
              href="/admin/notifications"
              className="mb-4 inline-block underline"
            >
              Manage multilingual email templates
            </Link>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Notification",
                      "Status",
                      "Attempts",
                      "Created",
                      "Action",
                    ].map((v) => (
                      <th key={v} className="p-2">
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mail.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{row.kind}</td>
                      <td>{row.status}</td>
                      <td>{row.attempts}</td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      <td>
                        {row.status === "DEAD" && (
                          <button
                            className="underline"
                            onClick={async () => {
                              try {
                                await secureApiFetch(
                                  "staff",
                                  `/admin/notifications/${row.id}/retry`,
                                  {
                                    method: "POST",
                                    headers: { "x-mfa-code": mfa },
                                    body: "{}",
                                  },
                                );
                                await load();
                              } catch (e) {
                                setMessage(String(e));
                              }
                            }}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p>
            <Link href="/admin/pricing" className="underline">
              Markets, currencies and checkout settings
            </Link>{" "}
            ·{" "}
            <Link href="/admin/security" className="underline">
              Security settings
            </Link>
          </p>
        </div>
      )}
      {section === "reports" && data.events && (
        <div className="space-y-6">
          {data.metrics && (
            <OperationMetrics metrics={data.metrics} mfa={mfa} />
          )}
          <p>
            Activity events: last {data.periodDays} days. Business state counts:
            current totals. Financial amounts are shown only with financial
            report permission.
          </p>
          {[
            "events",
            "leads",
            "applications",
            "pages",
            "orders",
            "purchaseOrders",
            "mail",
          ].map((group) => (
            <section key={group} className="rounded-xl border p-5">
              <h2 className="mb-4 text-xl font-bold">{group}</h2>
              <div className="overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Category</th>
                      <th>Count</th>
                      {data.financial &&
                        ["orders", "purchaseOrders"].includes(group) && (
                          <th>Amount (cents, mixed currencies not summed)</th>
                        )}
                    </tr>
                  </thead>
                  <tbody>
                    {(data[group] ?? []).map((row: Data, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">
                          {row.name ?? row.status} {row.source ?? ""}{" "}
                          {row.currency ?? ""} {row.market ?? ""}
                        </td>
                        <td>{row._count}</td>
                        {row.totalCents !== undefined && (
                          <td>{row.totalCents}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <section className="rounded-xl border p-5">
            <h2 className="mb-4 text-xl font-bold">Search phrases</h2>
            <ul className="space-y-2">
              {(data.searches ?? [])
                .slice(0, 100)
                .map((row: Data, i: number) => (
                  <li key={i}>
                    {row.query} · {row.results_count} results
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}
      {section === "seo" && data.pages && (
        <div className="space-y-6">
          <section className="rounded-xl border p-5">
            <h2 className="text-xl font-bold">Content checks</h2>
            <p className="my-3">
              Public images missing alt text: {data.missingAlt}
            </p>
            <ul className="divide-y">
              {data.pages.map((row: Data) => (
                <li
                  key={row.id}
                  className="flex flex-wrap justify-between gap-3 py-3"
                >
                  <span>
                    {row.title} / {row.slug} ({row.status})
                  </span>
                  <span>
                    {row.missingDescription ? "Missing description " : ""}
                    {row.duplicateTitle ? "Duplicate title" : ""}
                  </span>
                  <Link href="/admin/cms" className="underline">
                    Edit content
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <form
            className="rounded-xl border p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await secureApiFetch("staff", "/admin/seo/redirects", {
                  method: "POST",
                  headers: { "x-mfa-code": mfa },
                  body: JSON.stringify({
                    source: form.get("source"),
                    destination: form.get("destination"),
                    status: Number(form.get("status")),
                  }),
                });
                setMessage("Redirect saved.");
                await load();
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to save redirect",
                );
              }
            }}
          >
            <h2 className="text-xl font-bold">Redirects</h2>
            <div className="my-4 grid gap-3 sm:grid-cols-3">
              <label>
                Old path
                <input
                  name="source"
                  required
                  pattern="/.*"
                  className={inputClass}
                />
              </label>
              <label>
                Destination path
                <input
                  name="destination"
                  required
                  pattern="/.*"
                  className={inputClass}
                />
              </label>
              <label>
                Status
                <select name="status" className={inputClass}>
                  <option>301</option>
                  <option>302</option>
                </select>
              </label>
            </div>
            <button className="rounded border px-4 py-2">Save redirect</button>
            <ul className="mt-5 space-y-2">
              {redirects.map((r) => (
                <li key={r.id}>
                  {r.source} → {r.destination} ({r.status})
                </li>
              ))}
            </ul>
          </form>
          <RedirectImport mfa={mfa} onSaved={load} />
          <section className="rounded-xl border p-5">
            <h2 className="mb-3 text-xl font-bold">Recent 404 pages</h2>
            {data.notFound.map((row: Data) => (
              <p key={row.id}>{row.path}</p>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}

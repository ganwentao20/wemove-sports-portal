"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { secureApiFetch } from "../../../lib/secure-api";

type Body = { subject: string; text: string; html?: string };
type Template = { kind: string; locales: Record<string, Body> };
type Configuration = {
  templates: Template[];
  defaultLocale: string;
  sender: { configured: boolean; from: string; workerEnabled: boolean };
};
const field = "mt-1 w-full rounded border border-neutral-300 p-2";
export default function NotificationTemplatesPage() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [kind, setKind] = useState("account.verify");
  const [locale, setLocale] = useState("en");
  const [groups, setGroups] = useState({ dealer: "", support: "", orders: "" });
  const [mfa, setMfa] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{
    subject: string;
    text: string;
    html?: string;
    locale: string;
  } | null>(null);
  const current = templates.find((item) => item.kind === kind);
  const body = current?.locales[locale] ?? {
    subject: "{{subject}}",
    text: "{{text}}",
  };
  useEffect(() => {
    void Promise.all([
      secureApiFetch<Configuration>("staff", "/admin/notifications/templates"),
      secureApiFetch<Record<"dealer" | "support" | "orders", string[]>>(
        "staff",
        "/admin/notifications/groups",
      ),
    ])
      .then(([configuration, recipients]) => {
        setConfig(configuration);
        setTemplates(
          configuration.templates.map(({ kind, locales }) => ({
            kind,
            locales,
          })),
        );
        setGroups({
          dealer: recipients.dealer.join("\n"),
          support: recipients.support.join("\n"),
          orders: recipients.orders.join("\n"),
        });
      })
      .catch((cause) => setError(cause.message));
  }, []);
  const change = (name: keyof Body, value: string) =>
    setTemplates((items) =>
      items.map((item) =>
        item.kind === kind
          ? {
              ...item,
              locales: {
                ...item.locales,
                [locale]: { ...body, [name]: value },
              },
            }
          : item,
      ),
    );
  async function save(target: "templates" | "groups") {
    if (!/^\d{6}$/.test(mfa)) {
      setError("Enter your current six-digit MFA code.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await secureApiFetch("staff", `/admin/notifications/${target}`, {
        method: "PUT",
        headers: { "x-mfa-code": mfa },
        body: JSON.stringify(
          target === "templates"
            ? { templates }
            : Object.fromEntries(
                Object.entries(groups).map(([name, value]) => [
                  name,
                  value
                    .split(/[\n,;]/)
                    .map((email) => email.trim())
                    .filter(Boolean),
                ]),
              ),
        ),
      });
      setNotice(
        target === "templates"
          ? "Templates saved. New and retried deliveries use these versions."
          : "Internal recipient groups saved.",
      );
      setMfa("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <Link href="/admin/platform" className="text-sm underline">
        Platform settings and delivery queue
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Notification templates</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Choose the message and language, edit its content, and preview it with
        sample values. Transactional messages remain active when a customer opts
        out of marketing.
      </p>
      {config && (
        <p className="mt-3 rounded bg-neutral-100 p-3 text-sm">
          Sender: {config.sender.from} ·{" "}
          {config.sender.configured
            ? "SMTP configured"
            : "SMTP pending configuration"}{" "}
          ·{" "}
          {config.sender.workerEnabled
            ? "Delivery worker enabled"
            : "Delivery worker paused"}{" "}
          · Default language: {config.defaultLocale}
        </p>
      )}
      <label className="my-5 block max-w-xs text-sm">
        MFA code
        <input
          value={mfa}
          onChange={(event) =>
            setMfa(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          className={field}
        />
      </label>
      <p role="alert" className="text-red-700">
        {error}
      </p>
      <p role="status" className="text-green-800">
        {notice}
      </p>
      <section className="mt-6 rounded-xl border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Message
            <select
              className={field}
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPreview(null);
              }}
            >
              {templates.map((template) => (
                <option key={template.kind}>{template.kind}</option>
              ))}
            </select>
          </label>
          <label>
            Language
            <select
              className={field}
              value={locale}
              onChange={(event) => {
                setLocale(event.target.value);
                setPreview(null);
              }}
            >
              {[
                ...new Set([
                  "en",
                  "zh",
                  ...Object.keys(current?.locales ?? {}),
                ]),
              ].map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-4 block">
          Subject
          <input
            value={body.subject}
            onChange={(event) => change("subject", event.target.value)}
            className={field}
            maxLength={200}
          />
        </label>
        <label className="mt-4 block">
          Plain text message
          <textarea
            value={body.text}
            onChange={(event) => change("text", event.target.value)}
            className={field}
            rows={7}
          />
        </label>
        <details className="mt-4">
          <summary className="cursor-pointer">Optional HTML message</summary>
          <textarea
            aria-label="HTML message"
            value={body.html ?? ""}
            onChange={(event) => change("html", event.target.value)}
            className={field}
            rows={6}
          />
        </details>
        <p className="mt-3 text-xs text-neutral-500">
          Common variables:{" "}
          {"{{name}}, {{email}}, {{subject}}, {{text}}, {{link}}, {{kind}}"}.
          Business events may provide reference, status, paymentStatus or
          eventKind. Missing values stop the message and record an error in the
          delivery queue.
        </p>
        <button
          onClick={() => void save("templates")}
          disabled={busy || !config}
          className="mt-4 rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Save templates
        </button>
        <form
          className="mt-6 border-t pt-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            setError("");
            setBusy(true);
            try {
              setPreview(
                await secureApiFetch("staff", "/admin/notifications/preview", {
                  method: "POST",
                  body: JSON.stringify({
                    kind,
                    locale,
                    to: String(values.get("to")),
                    subject: "Sample notification",
                    text: "Sample business details",
                    variables: JSON.parse(String(values.get("variables"))),
                    template: body,
                  }),
                }),
              );
            } catch (cause) {
              setError((cause as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="text-lg font-semibold">Preview without sending</h2>
          <label className="mt-3 block">
            Sample recipient
            <input
              type="email"
              required
              name="to"
              defaultValue="preview@example.test"
              className={field}
            />
          </label>
          <label className="mt-3 block">
            Sample variables (JSON)
            <textarea
              name="variables"
              className={field}
              rows={4}
              defaultValue={JSON.stringify(
                {
                  name: "Alex",
                  reference: "WM-1001",
                  status: "CONFIRMED",
                  paymentStatus: "PAID",
                  link: "https://example.test/orders/WM-1001",
                  eventKind: "order.checkout",
                },
                null,
                2,
              )}
            />
          </label>
          <button
            disabled={busy || !config}
            className="mt-3 rounded border px-4 py-2 disabled:opacity-50"
          >
            Preview current draft
          </button>
        </form>
        {preview && (
          <div className="mt-4 rounded bg-neutral-100 p-4">
            <h3 className="font-semibold">
              {preview.subject} · {preview.locale}
            </h3>
            <p className="mt-3 whitespace-pre-wrap">{preview.text}</p>
            {preview.html && (
              <details className="mt-3">
                <summary>Rendered HTML source</summary>
                <pre className="overflow-auto whitespace-pre-wrap text-xs">
                  {preview.html}
                </pre>
              </details>
            )}
          </div>
        )}
      </section>
      <section className="mt-6 rounded-xl border p-5">
        <h2 className="text-xl font-semibold">Internal recipient groups</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Enter one address per line. Groups receive separate operational
          notifications with management links. Verification and invitation
          credentials stay in the recipient’s own message.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(["dealer", "support", "orders"] as const).map((name) => (
            <label key={name} className="capitalize">
              {name}
              <textarea
                className={field}
                rows={5}
                value={groups[name]}
                onChange={(event) =>
                  setGroups((values) => ({
                    ...values,
                    [name]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <button
          onClick={() => void save("groups")}
          disabled={busy || !config}
          className="mt-4 rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Save recipient groups
        </button>
      </section>
    </main>
  );
}

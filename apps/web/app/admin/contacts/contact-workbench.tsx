"use client";
import Link from "next/link";
import { ContactThread } from "../../../components/contact-thread";
import {
  ContactHistory,
  type ContactEntry,
} from "../../../components/contact-history";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  country: string | null;
  subject: string;
  content: string;
  status: string;
  createdAt: string;
  source: string;
  priority: string;
  assignedTo: string | null;
  assignedTeam: string | null;
  tags: string[];
  history: ContactEntry[];
  attachments: string[];
};
type Page = {
  items: ContactMessage[];
  total: number;
  page: number;
  pageSize: number;
};
const statuses = [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];
const sources = [
  "CONTACT",
  "PRODUCT_INQUIRY",
  "ORDER_SUPPORT",
  "DEALER_SUPPORT",
  "PRIVACY",
];
const field =
  "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2";
export function ContactWorkbench() {
  const router = useRouter();
  const [result, setResult] = useState<Page>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState(""),
    [mfa, setMfa] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [canWrite, setCanWrite] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, me] = await Promise.all([
        secureApiFetch<Page>(
          "staff",
          `/contacts?${filters}&page=${page}&pageSize=20`,
        ),
        secureApiFetch<{ roles: string[]; permissions: string[] }>(
          "staff",
          "/admin/me",
        ),
      ]);
      setResult(data);
      setCanWrite(
        me.roles.includes("SUPER_ADMIN") ||
          me.permissions.some((p) =>
            ["contact:write", "cms:contact:manage"].includes(p),
          ),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("staff").catch(() => undefined);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof Error ? cause.message : "Unable to load messages.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, page, filters]);
  useEffect(() => {
    void load();
  }, [load]);
  async function updateStatus(item: ContactMessage, status: string) {
    if (!/^\d{6}$/.test(mfa)) {
      setError("Enter the current 6-digit MFA code.");
      return;
    }
    setBusy(item.id);
    setError("");
    try {
      await secureApiFetch("staff", `/contacts/${item.id}/status`, {
        method: "PUT",
        headers: { "x-mfa-code": mfa },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update status.",
      );
    } finally {
      setBusy("");
    }
  }
  async function download() {
    if (!/^\d{6}$/.test(mfa)) {
      setError("Enter the current 6-digit MFA code before exporting.");
      return;
    }
    setBusy("export");
    setError("");
    try {
      const response = await fetch(
        `/api/secure/staff/contacts/export?${filters}`,
        { headers: { "x-wemove-csrf": "1", "x-mfa-code": mfa } },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Export failed.");
      }
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = "contacts.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to export messages.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <Link href="/admin/dashboard" className="underline">
        Operations dashboard
      </Link>
      <div className="my-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contact inbox</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Customer messages, assignments and handling history.
          </p>
        </div>
        <label>
          MFA code
          <input
            value={mfa}
            onChange={(e) =>
              setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            className="ml-2 w-28 rounded-lg border p-2"
          />
        </label>
      </div>
      <form
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget),
            params = new URLSearchParams();
          for (const [key, value] of form) {
            if (String(value).trim()) params.set(key, String(value).trim());
          }
          setPage(1);
          setFilters(params.toString());
          setError("");
        }}
      >
        <label>
          Search name, email or message
          <input name="search" maxLength={160} className={field} />
        </label>
        <label>
          Status
          <select name="status" className={field}>
            <option value="">All statuses</option>
            {statuses.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" className={field}>
            <option value="">All priorities</option>
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select name="source" className={field}>
            <option value="">All sources</option>
            {sources.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Team
          <input name="assignedTeam" maxLength={100} className={field} />
        </label>
        <label>
          Assignment
          <select name="assignedTo" className={field}>
            <option value="">All staff</option>
            <option value="UNASSIGNED">Unassigned</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-3">
          <button disabled={loading} className="rounded-lg border px-4 py-2">
            Apply filters
          </button>
          <button
            type="reset"
            className="rounded-lg border px-4 py-2"
            onClick={() => {
              setFilters("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || loading}
            className="rounded-lg border px-4 py-2"
            onClick={() => void download()}
          >
            Export filtered CSV
          </button>
        </div>
        <p className="text-sm text-neutral-700 sm:col-span-3">
          CSV includes all matching requests and omits customer emails, names,
          messages and internal notes.
        </p>
      </form>
      {error && (
        <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <p role="status" className="mt-4">
        {loading
          ? "Loading requests…"
          : `${result.total} matching requests · Page ${result.page} of ${Math.max(1, Math.ceil(result.total / result.pageSize))}`}
      </p>
      <div className="mt-6 space-y-4">
        {!loading && !result.items.length && (
          <p className="rounded-xl border p-6">
            No requests match these filters.
          </p>
        )}
        {result.items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.subject}</h2>
                <p className="mt-1 text-sm text-neutral-700">
                  {item.name} · {item.email}
                  {item.country ? ` · ${item.country}` : ""} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              {canWrite ? (
                <select
                  aria-label={`Status for ${item.subject}`}
                  value={item.status}
                  disabled={busy === item.id}
                  onChange={(e) => void updateStatus(item, e.target.value)}
                  className="rounded-lg border px-3 py-2"
                >
                  {statuses.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <span>{item.status}</span>
              )}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
              {item.content}
            </p>
            <p className="mt-3 text-sm">
              {item.source} · {item.priority} · {item.assignedTeam ?? "No team"}{" "}
              · {item.assignedTo ? "Assigned" : "Unassigned"} ·{" "}
              {item.tags.join(", ")}
            </p>
            <ContactHistory
              id={item.id}
              history={item.history ?? []}
              attachments={item.attachments ?? []}
            />
            {canWrite && (
              <ContactThread
                id={item.id}
                mfa={mfa}
                reload={load}
                current={item}
              />
            )}
          </article>
        ))}
      </div>
      <nav aria-label="Contact pages" className="mt-6 flex gap-4">
        <button
          disabled={loading || page <= 1}
          className="rounded border px-4 py-2"
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <button
          disabled={loading || page * result.pageSize >= result.total}
          className="rounded border px-4 py-2"
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </nav>
    </main>
  );
}

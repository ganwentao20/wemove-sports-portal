"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type ContactStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type ContactMessage = {
  id: string;
  name: string;
  email: string;
  country: string | null;
  subject: string;
  content: string;
  status: ContactStatus;
  createdAt: string;
};

const statuses: ContactStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function ContactWorkbench() {
  const router = useRouter();
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await secureApiFetch<ContactMessage[]>("staff", "/contacts"));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("staff").catch(() => undefined);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load contact messages.",
      );
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(item: ContactMessage, status: ContactStatus) {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the current 6-digit MFA code before updating a message.");
      return;
    }
    if (
      !window.confirm(
        `Change “${item.subject}” from ${item.status} to ${status}?`,
      )
    )
      return;
    setBusy(item.id);
    setError("");
    try {
      await secureApiFetch("staff", `/contacts/${item.id}/status`, {
        method: "PUT",
        headers: { "x-mfa-code": mfaCode },
        body: JSON.stringify({ status }),
      });
      setMfaCode("");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to update the message.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
          <h1 className="mt-1 text-3xl font-bold">Contact inbox</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Customer messages and auditable handling status.
          </p>
        </div>
        <label className="text-sm">
          MFA code
          <input
            value={mfaCode}
            onChange={(event) =>
              setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="ml-2 w-28 rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="mt-6 space-y-4">
        {items.length === 0 && (
          <p className="rounded-xl border border-neutral-200 p-6 text-neutral-500">
            No messages yet.
          </p>
        )}
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <h2 className="font-semibold">{item.subject}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {item.name} · {item.email}
                  {item.country ? ` · ${item.country}` : ""} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <select
                aria-label={`Status for ${item.subject}`}
                disabled={busy === item.id}
                value={item.status}
                onChange={(event) =>
                  void updateStatus(item, event.target.value as ContactStatus)
                }
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
              {item.content}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}

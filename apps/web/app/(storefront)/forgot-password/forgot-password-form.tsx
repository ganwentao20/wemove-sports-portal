"use client";

import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: String(form.get("email") ?? "").trim() }),
      });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to process the request.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <p role="status" className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">If an eligible account exists, reset instructions are on the way.</p>;

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <input required type="email" name="email" autoComplete="email" maxLength={160} placeholder="Email" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm" />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send reset instructions"}</button>
    </form>
  );
}

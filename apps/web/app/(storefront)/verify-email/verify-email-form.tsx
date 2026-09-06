"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";

export function VerifyEmailForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? "" : "This verification link is missing its token.");
  const [verified, setVerified] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
      setVerified(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to verify this email.");
    } finally {
      setBusy(false);
    }
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email: String(form.get("email") ?? "").trim() }) });
      setResent(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to resend verification.");
    } finally {
      setBusy(false);
    }
  }

  if (verified) return <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Email verified. <Link href="/customer/login" className="font-semibold underline">Sign in</Link></div>;

  return (
    <div className="mt-8 space-y-6">
      <button type="button" onClick={() => void verify()} disabled={busy || !token} className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Verifying…" : "Verify email"}</button>
      <form onSubmit={resend} className="space-y-3 border-t border-neutral-200 pt-6">
        <p className="text-sm text-neutral-600">Need a fresh link?</p>
        <input required type="email" name="email" maxLength={160} placeholder="Email" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm" />
        <button disabled={busy} className="text-sm font-semibold text-[var(--wm-primary)] underline">Resend verification email</button>
        {resent && <p role="status" className="text-sm text-emerald-700">If the account is awaiting verification, a new link is on the way.</p>}
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

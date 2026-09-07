"use client";
import { useHydrated } from "../../../lib/use-hydrated";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "../../../lib/api";
import { sessionLogin } from "../../../lib/secure-api";
import { safeRedirect } from "../../../lib/safe-redirect";

type LoginResult = { user: { id: string; email: string; name: string } };

export function CustomerLoginForm() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await sessionLogin<LoginResult>("customer", {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        ...(form.get("code") ? { code: String(form.get("code")) } : {}),
      });
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = safeRedirect(requested, "/customer/account");
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Sign in failed.");
      setSubmitting(false);
    }
  }

  return (
    <form method="POST" className="mt-8 space-y-4" onSubmit={submit}>
      <fieldset
        disabled={!hydrated}
        className="space-y-4"
        aria-busy={!hydrated}
      >
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Email"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[var(--wm-primary)] underline"
          >
            Forgot password?
          </Link>
        </div>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
        <label className="block text-sm">
          Authenticator code (if enabled)
          <input
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            className="mt-1 w-full rounded-xl border px-4 py-3"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button
          disabled={submitting}
          className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </fieldset>
    </form>
  );
}

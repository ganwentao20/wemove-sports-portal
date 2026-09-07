"use client";
import { useHydrated } from "../../../lib/use-hydrated";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { sessionLogin } from "../../../lib/secure-api";

type LoginResult = {
  user: {
    mfaRequired?: boolean;
    mfaEnabled?: boolean;
    dealerTermsRequired?: boolean;
    companyId: string;
  };
};

export function DealerLoginForm() {
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
      const result = await sessionLogin<LoginResult>("dealer", {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        ...(form.get("code") ? { code: String(form.get("code")) } : {}),
      });
      router.push(
        result.user.mfaRequired && !result.user.mfaEnabled
          ? "/dealer/security"
          : result.user.dealerTermsRequired
            ? "/dealer/terms"
            : "/dealer/catalog",
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Sign in failed.");
      setSubmitting(false);
    }
  }

  return (
    <form method="POST" onSubmit={submit} className="mt-8 space-y-4">
      <fieldset
        disabled={!hydrated}
        className="space-y-4"
        aria-busy={!hydrated}
      >
        <label className="block text-sm">
          Business email
          <input
            name="email"
            autoComplete="email"
            type="email"
            required
            placeholder="Business email"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            autoComplete="current-password"
            type="password"
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

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "../../../lib/api";
import { sessionLogin } from "../../../lib/secure-api";

type LoginResult = { user: { id: string; email: string; name: string } };

export function CustomerLoginForm() {
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
      });
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination =
        requested?.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/customer/account";
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Sign in failed.");
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={submit}>
      <input
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="Email"
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
      />
      <div className="text-right">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-[var(--wm-primary)] underline"
        >
          Forgot password?
        </Link>
      </div>
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Password"
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
      />
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
    </form>
  );
}

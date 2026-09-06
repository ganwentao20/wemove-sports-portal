"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { sessionLogin } from "../../../lib/secure-api";

type LoginResult = { user: { companyId: string } };

export function DealerLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await sessionLogin<LoginResult>("dealer", {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      router.push("/dealer/catalog");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Sign in failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <input
        name="email"
        type="email"
        required
        placeholder="Business email"
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
      />
      <input
        name="password"
        type="password"
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

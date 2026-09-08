"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";

export function VerifyEmailForm({ token }: { token: string }) {
  const t = useUiText();
  const uiLocale = useUiLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    token ? "" : "This verification link is missing its token.",
  );
  const [verified, setVerified] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setVerified(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to verify this email.",
      );
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
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: String(form.get("email") ?? "").trim() }),
      });
      setResent(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to resend verification.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (verified)
    return (
      <div
        role="status"
        className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {t("Email verified.")}
        <Link href={`/${uiLocale}/login`} className="font-semibold underline">
          {t("Sign in")}
        </Link>
      </div>
    );

  return (
    <div className="mt-8 space-y-6">
      <button
        type="button"
        onClick={() => void verify()}
        disabled={busy || !token}
        className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? t("Verifying…") : t("Verify email")}
      </button>
      <form
        onSubmit={resend}
        className="space-y-3 border-t border-neutral-200 pt-6"
      >
        <p className="text-sm text-neutral-600">{t("Need a fresh link?")}</p>
        <div className="space-y-2">
          <label
            htmlFor="verify-email-address"
            className="block text-sm font-medium"
          >
            {t("Email")}
          </label>
          <input
            id="verify-email-address"
            required
            type="email"
            name="email"
            autoComplete="email"
            maxLength={160}
            placeholder={t("Email")}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm"
          />
        </div>
        <button
          disabled={busy}
          className="text-sm font-semibold text-[var(--wm-primary)] underline"
        >
          {t("Resend verification email")}
        </button>
        {resent && (
          <p role="status" className="text-sm text-emerald-700">
            {t(
              "If the account is awaiting verification, a new link is on the way.",
            )}
          </p>
        )}
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {uiError(uiLocale, error)}
        </p>
      )}
    </div>
  );
}

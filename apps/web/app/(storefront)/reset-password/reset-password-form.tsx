"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useUiText();
  const uiLocale = useUiLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    token ? "" : "This reset link is missing its token.",
  );
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to reset the password.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div
        role="status"
        className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {t("Password updated.")}
        <Link href={`/${uiLocale}/login`} className="font-semibold underline">
          {t("Sign in")}
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="reset-password-new"
          className="block text-sm font-medium"
        >
          {t("New password")}
        </label>
        <input
          id="reset-password-new"
          aria-describedby="reset-password-rules"
          required
          minLength={8}
          maxLength={72}
          pattern="(?=.*[A-Za-z])(?=.*\d).+"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={t("New password")}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm"
        />
        <p id="reset-password-rules" className="text-sm text-neutral-600">
          {t("Use 8–72 characters, including a letter and a number.")}
        </p>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="reset-password-confirm"
          className="block text-sm font-medium"
        >
          {t("Confirm new password")}
        </label>
        <input
          id="reset-password-confirm"
          aria-describedby="reset-password-rules"
          required
          minLength={8}
          maxLength={72}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={t("Confirm new password")}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {uiError(uiLocale, error)}
        </p>
      )}
      <button
        disabled={busy || !token}
        className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? t("Saving…") : t("Save new password")}
      </button>
    </form>
  );
}

"use client";
import { uiError } from "../../../lib/ui-i18n";

import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { useHydrated } from "../../../lib/use-hydrated";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "../../../lib/api";

type RegisterResult = {
  id: string;
  email: string;
  status: "ACTIVE" | "PENDING";
};

export function CustomerRegisterForm() {
  const uiLocale = useUiLocale();

  const t = useUiText();

  const hydrated = useHydrated();
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const created = await apiFetch<RegisterResult>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          ageConfirmed: form.get("ageConfirmed") === "on",
          termsAccepted: form.get("termsAccepted") === "on",
          marketingEmail: form.get("marketingEmail") === "on",
          productUpdates: form.get("productUpdates") === "on",
        }),
      });
      setResult(created);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Registration failed.",
      );
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <h2 className="font-semibold">{t("Account created")}</h2>
        <p className="mt-2">
          {result.status === "PENDING"
            ? t("Check {v0} for the verification email before signing in.", {
                v0: String(result.email),
              })
            : t("Your account is active and ready to use.")}
        </p>
        <Link
          href={`/${uiLocale}/login`}
          className="mt-4 inline-block font-semibold underline"
        >
          {t("Continue to sign in")}
        </Link>
      </div>
    );
  }

  return (
    <form method="POST" className="mt-8 space-y-4" onSubmit={submit}>
      <fieldset
        disabled={!hydrated}
        className="space-y-4"
        aria-busy={!hydrated}
      >
        <label className="block text-sm">
          {t("Full name")}
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={60}
            placeholder={t("Full name")}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
        <label className="block text-sm">
          {t("Email")}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t("Email")}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
        <label className="block text-sm">
          {t("Password")}
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            pattern="(?=.*[A-Za-z])(?=.*\d).+"
            title={t(
              "Use 8–72 characters with at least one letter and one number.",
            )}
            placeholder={t("Password (8+ chars, letters & numbers)")}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-neutral-600">
          <input
            name="ageConfirmed"
            type="checkbox"
            required
            className="mt-1"
          />
          <span>{t("I confirm I am 18 or older.")}</span>
        </label>
        <label className="flex gap-2 items-start text-sm">
          <input
            name="termsAccepted"
            type="checkbox"
            required
            className="mt-1"
          />
          <span>
            {t("I agree to the")}{" "}
            <Link href="/terms" className="underline">
              {t("Terms")}
            </Link>{" "}
            {t("and")}{" "}
            <Link href="/privacy" className="underline">
              {t("Privacy Policy")}
            </Link>
            .
          </span>
        </label>
        <label className="flex gap-2 text-sm">
          <input name="marketingEmail" type="checkbox" />
          {t("Email me offers and news (optional)")}
        </label>
        <label className="flex gap-2 text-sm">
          <input name="productUpdates" type="checkbox" />
          {t("Email me product updates (optional)")}
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error ? uiError(uiLocale, error) : ""}
          </p>
        )}
        <button
          disabled={submitting}
          className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? t("Creating account…") : t("Create account")}
        </button>
      </fieldset>
    </form>
  );
}

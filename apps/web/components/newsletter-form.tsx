"use client";
import { recordEvent } from "./consent-analytics";
import { ui } from "../lib/ui-strings";
import { useState } from "react";
import { apiFetch } from "../lib/api";
export function NewsletterForm({ locale = "en" }: { locale?: string }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-xl rounded-2xl border border-[var(--wm-border)] p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const data = new FormData(event.currentTarget);
        try {
          await apiFetch("/newsletter", {
            method: "POST",
            body: JSON.stringify({
              email: data.get("email"),
              locale,
              consent: data.get("consent") === "on",
              consentVersion: "2026-09",
              website: "",
            }),
          });
          recordEvent("newsletter_subscribe", {
            language: locale,
            form_type: "newsletter",
          });
          setMessage(
            ui(locale, "Check your email to confirm your subscription."),
          );
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Unable to subscribe",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-2xl font-bold">
        {ui(locale, "Ideas for active play")}
      </h2>
      <label className="mt-5 block">
        {ui(locale, "Email")}
        <input
          name="email"
          type="email"
          required
          maxLength={160}
          className="mt-2 w-full rounded-lg border p-3"
        />
      </label>
      <label className="my-4 flex gap-3 text-sm">
        <input name="consent" type="checkbox" required />
        {ui(
          locale,
          "I agree to the privacy policy and to receive marketing emails.",
        )}
      </label>
      <button
        disabled={busy}
        className="rounded-lg bg-[var(--wm-primary)] px-5 py-3 text-white"
      >
        {ui(locale, "Subscribe")}
      </button>
      <p role="status" className="mt-3">
        {message}
      </p>
    </form>
  );
}

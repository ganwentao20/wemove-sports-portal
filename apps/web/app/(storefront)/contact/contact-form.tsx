"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { FormEvent, useState, useRef } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import Link from "next/link";
import { recordEvent } from "../../../components/consent-analytics";

export function ContactForm() {
  const t = useUiText();
  const uiLocale = useUiLocale();
  const submission = useRef<{
    fingerprint: string;
    key: string;
    attachments: Array<{ mediaId: string; attachmentToken: string }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const files = form
        .getAll("attachments")
        .filter((item): item is File => item instanceof File && item.size > 0);
      if (files.length > 5) throw new Error("Choose at most five attachments");
      const fingerprint = JSON.stringify(
        [...form.entries()].map(([key, value]) => [
          key,
          value instanceof File
            ? `${value.name}:${value.size}:${value.lastModified}`
            : value,
        ]),
      );
      if (!submission.current || submission.current.fingerprint !== fingerprint)
        submission.current = {
          fingerprint,
          key: crypto.randomUUID(),
          attachments: [],
        };
      if (submission.current.attachments.length !== files.length) {
        const attachments = [];
        for (const file of files) {
          if (file.size > 5 * 1024 * 1024)
            throw new Error("Each attachment must be at most 5 MB");
          const payload = new FormData();
          payload.append("file", file);
          attachments.push(
            await apiFetch<{ mediaId: string; attachmentToken: string }>(
              "/contacts/attachments",
              { method: "POST", body: payload },
            ).then((item) => ({
              mediaId: item.mediaId,
              attachmentToken: item.attachmentToken,
            })),
          );
        }
        submission.current.attachments = attachments;
      }
      const attachments = submission.current.attachments;
      await apiFetch("/contacts", {
        method: "POST",
        body: JSON.stringify({
          submissionKey: submission.current.key,
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          country: String(form.get("country") ?? "").trim() || undefined,
          subject: String(form.get("subject") ?? "").trim(),
          content: String(form.get("content") ?? "").trim(),
          website: String(form.get("website") ?? ""),
          consent: form.get("consent") === "on",
          consentVersion: "privacy-2026-09",
          source: form.get("source"),
          attachments,
        }),
      });
      formElement.reset();
      submission.current = null;
      recordEvent("contact_submit", {
        form_type: "contact",
        source: String(form.get("source")),
      });
      setNotice(
        "Your message has been received. A confirmation email includes your request reference.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "We could not send your message. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          {t("Your name")}
          <input
            required
            minLength={2}
            maxLength={80}
            name="name"
            autoComplete="name"
            placeholder={t("Your name")}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
        <label className="grid gap-2">
          {t("Email")}
          <input
            required
            maxLength={160}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("Email")}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
          />
        </label>
      </div>
      <label className="grid gap-2">
        {t("Country (optional)")}
        <input
          maxLength={80}
          name="country"
          autoComplete="country-name"
          placeholder={t("Country (optional)")}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
        />
      </label>
      <label className="grid gap-2">
        {t("Request type")}
        <select name="source" className="rounded-xl border px-4 py-3">
          {[
            ["CONTACT", "General question"],
            ["PRODUCT_INQUIRY", "Product inquiry"],
            ["ORDER_SUPPORT", "Order support"],
            ["DEALER_SUPPORT", "Dealer support"],
            ["PRIVACY", "Privacy request"],
          ].map(([value, label]) => (
            <option value={value} key={value}>
              {t(String(label))}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2">
        {t("Subject")}
        <input
          required
          minLength={2}
          maxLength={160}
          name="subject"
          placeholder={t("Subject")}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
        />
      </label>
      <label className="grid gap-2">
        {t("Message")}
        <textarea
          required
          minLength={10}
          maxLength={4000}
          name="content"
          rows={5}
          placeholder={t("Message")}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
        />
      </label>
      <label className="grid gap-2">
        {t(
          "Attachments (optional, up to five JPG/PNG/WebP/PDF files, 5 MB each)",
        )}
        <input
          type="file"
          name="attachments"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="w-full rounded-xl border p-3"
        />
      </label>
      <label className="flex items-start gap-3">
        <input required type="checkbox" name="consent" className="mt-1" />
        <span>
          {t("I agree to the")}{" "}
          <Link href="/privacy" className="underline">
            {t("Privacy Policy")}
          </Link>{" "}
          {t(
            "and consent to processing this request. Do not include payment credentials or information about children.",
          )}
        </span>
      </label>
      <label className="absolute -left-[10000px]" aria-hidden="true">
        {t("Website")}
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {uiError(uiLocale, error)}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {t(String(notice))}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded-full bg-[var(--wm-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? t("Sending…") : t("Send message")}
      </button>
    </form>
  );
}

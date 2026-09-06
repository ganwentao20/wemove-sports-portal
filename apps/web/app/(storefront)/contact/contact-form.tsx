"use client";

import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";

export function ContactForm() {
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
      await apiFetch("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          country: String(form.get("country") ?? "").trim() || undefined,
          subject: String(form.get("subject") ?? "").trim(),
          content: String(form.get("content") ?? "").trim(),
          website: String(form.get("website") ?? ""),
        }),
      });
      formElement.reset();
      setNotice(
        "Thanks — your message has been received. We will reply within 2 business days.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
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
        <input
          required
          minLength={2}
          maxLength={80}
          name="name"
          autoComplete="name"
          placeholder="Your name"
          className="rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
        />
        <input
          required
          maxLength={160}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          className="rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
        />
      </div>
      <input
        maxLength={80}
        name="country"
        autoComplete="country-name"
        placeholder="Country (optional)"
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
      />
      <input
        required
        minLength={2}
        maxLength={160}
        name="subject"
        placeholder="Subject"
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
      />
      <textarea
        required
        minLength={10}
        maxLength={4000}
        name="content"
        rows={5}
        placeholder="Message"
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]"
      />
      <label className="absolute -left-[10000px]" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded-full bg-[var(--wm-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

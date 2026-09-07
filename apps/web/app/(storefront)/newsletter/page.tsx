"use client";
import { useState } from "react";
import { apiFetch } from "../../../lib/api";
export default function NewsletterPage() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(unsubscribe: boolean) {
    setBusy(true);
    try {
      const token = new URLSearchParams(location.search).get("token");
      await apiFetch(`/newsletter/${unsubscribe ? "unsubscribe" : "confirm"}`, {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setMessage(
        unsubscribe
          ? "You are unsubscribed. Transactional emails are unaffected."
          : "Your subscription is confirmed. Bookmark this link to unsubscribe at any time.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update subscription",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Email subscription</h1>
      <p className="my-6">
        Confirm your subscription to receive play ideas and product news.
      </p>
      <div className="flex gap-4">
        <button
          disabled={busy}
          onClick={() => void act(false)}
          className="rounded-lg border p-3"
        >
          Confirm subscription
        </button>
        <button
          disabled={busy}
          onClick={() => void act(true)}
          className="rounded-lg border p-3"
        >
          Unsubscribe
        </button>
      </div>
      <p role="status" className="mt-5">
        {message}
      </p>
    </div>
  );
}

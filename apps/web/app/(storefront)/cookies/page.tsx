"use client";
import { saveConsent } from "../../../components/consent-analytics";
import { useEffect, useState } from "react";
export default function CookieSettings() {
  const [choice, setChoice] = useState("essential"),
    [saved, setSaved] = useState(false);
  useEffect(
    () => setChoice(localStorage.getItem("wm_consent") ?? "essential"),
    [],
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold">Cookie settings</h1>
      <p className="my-6 leading-7">
        Essential cookies support authentication, security and shopping.
        Optional analytics are stored only after your consent; they exclude
        names, contact details and payment credentials. Pseudonymous session,
        product and order references help us measure completed journeys.
      </p>
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={choice === "analytics"}
          onChange={(e) => {
            setSaved(false);
            setChoice(e.target.checked ? "analytics" : "essential");
          }}
        />
        Allow optional analytics
      </label>
      <button
        onClick={() => {
          saveConsent(choice);
          setSaved(true);
        }}
        className="mt-6 rounded-lg bg-[var(--wm-primary)] px-5 py-3 text-white"
      >
        Save preferences
      </button>
      {saved && (
        <p role="status" className="mt-4">
          Your preferences have been saved.
        </p>
      )}
    </div>
  );
}

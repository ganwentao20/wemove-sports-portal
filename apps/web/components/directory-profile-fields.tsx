"use client";
import { uiError } from "../lib/ui-i18n";

import { useUiText, useUiLocale } from "./ui-locale";

import { useState } from "react";
const fields = [
  ["publicLogo", "Public logo URL"],
  ["publicPhone", "Public business phone"],
  ["publicRegion", "State / province"],
  ["publicPostalCode", "Postal code"],
  ["publicHours", "Opening hours and business information"],
  ["publicDescription", "Store description"],
] as const;
export function DirectoryProfileFields({
  profile,
  admin,
  onReview,
}: {
  profile: Record<string, any>;
  admin: boolean;
  onReview: (
    approve: boolean,
    reason: string,
    submissionId: string,
  ) => Promise<void>;
}) {
  const uiLocale = useUiLocale();

  const t = useUiText();

  const [reason, setReason] = useState(""),
    [message, setMessage] = useState("");
  const pending = profile.directorySubmission as
    Record<string, unknown> | undefined;
  return (
    <fieldset className="space-y-4 rounded border p-4 sm:col-span-2">
      <legend className="px-2 font-semibold">
        {t("Public dealer directory")}
      </legend>
      <p className="text-sm text-neutral-700">
        {t(
          "Public details require platform review before publishing. Authorized categories come from the company catalog policy. Turning off publication hides the current listing immediately.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([key, label]) => (
          <label key={key}>
            {t(String(label))}
            {["publicDescription", "publicHours"].includes(key) ? (
              <textarea
                name={key}
                defaultValue={String(profile[key] ?? "")}
                maxLength={key === "publicHours" ? 1000 : 3000}
                rows={3}
                className="mt-1 block w-full rounded border p-2"
              />
            ) : (
              <input
                name={key}
                defaultValue={String(profile[key] ?? "")}
                className="mt-1 block w-full rounded border p-2"
              />
            )}
          </label>
        ))}
        {[
          ["onlineStore", "Online sales"],
          ["physicalStore", "Physical store"],
          ["publicDetail", "Enable an independent public store page"],
        ].map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              name={key}
              defaultChecked={profile[key] === true}
            />{" "}
            {t(String(label))}
          </label>
        ))}
      </div>
      {pending && (
        <div className="rounded bg-amber-50 p-3">
          <p className="font-semibold">
            {t("Directory changes awaiting platform review")}
          </p>
          <details className="mt-3">
            <summary>{t("Review submitted public content")}</summary>
            <dl className="mt-2 space-y-1">
              {Object.entries(pending)
                .filter(([key]) => !["id", "submittedBy"].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-semibold">{t(key)}</dt>
                    <dd className="whitespace-pre-wrap break-words">
                      {String(value ?? "")}
                    </dd>
                  </div>
                ))}
            </dl>
          </details>
          {admin && (
            <div className="mt-4">
              <label>
                {t("Review reason")}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                  className="mt-1 block w-full rounded border p-2"
                />
              </label>
              <div className="mt-3 flex gap-3">
                {[true, false].map((approve) => (
                  <button
                    type="button"
                    key={String(approve)}
                    className="rounded border bg-white px-4 py-2"
                    onClick={async () => {
                      if (reason.trim().length < 5) {
                        setMessage(
                          "Enter a review reason of at least five characters.",
                        );
                        return;
                      }
                      setMessage("");
                      await onReview(approve, reason, String(pending.id));
                    }}
                  >
                    {approve
                      ? t("Approve public changes")
                      : t("Reject changes")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {profile.directoryReview && (
        <p className="text-sm">
          {t("Last review:")}{" "}
          {profile.directoryReview.approved ? t("Approved") : t("Rejected")} —{" "}
          {profile.directoryReview.reason}
        </p>
      )}
      {message && (
        <p role="alert">{message ? uiError(uiLocale, message) : ""}</p>
      )}
    </fieldset>
  );
}

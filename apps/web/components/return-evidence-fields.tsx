"use client";
import { uiError } from "../lib/ui-i18n";

import { useUiText, useUiLocale } from "./ui-locale";

import { useState } from "react";
import { secureApiFetch } from "../lib/secure-api";
export type ReturnEvidence = {
  mediaId: string;
  attachmentToken: string;
  orderItemId: string;
  fileName: string;
};
export function ReturnEvidenceFields({
  orderId,
  lines,
  evidence,
  onEvidence,
  descriptions,
  onDescriptions,
  onBusy,
}: {
  orderId: string;
  lines: Array<{ id: string; sku: string }>;
  evidence: ReturnEvidence[];
  onEvidence: (value: ReturnEvidence[]) => void;
  descriptions: Record<string, string>;
  onDescriptions: (value: Record<string, string>) => void;
  onBusy: (value: boolean) => void;
}) {
  const uiLocale = useUiLocale();

  const t = useUiText();

  const [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  return (
    <fieldset disabled={uploading} className="space-y-4">
      <legend className="font-semibold">
        {t("Item details and private photos")}
      </legend>
      <p className="text-sm text-neutral-700">
        {t(
          "Optional: describe each selected item and attach up to five JPG, PNG or WebP photos, 5 MB each. Photos are available to you and authorized support staff.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error ? uiError(uiLocale, error) : ""}
        </p>
      )}
      {lines.map((line) => (
        <div key={line.id} className="space-y-2 rounded border p-3">
          <label className="block">
            {line.sku} {t("— what happened?")}
            <textarea
              className="mt-1 block w-full rounded border p-2"
              maxLength={2000}
              value={descriptions[line.id] ?? ""}
              onChange={(e) =>
                onDescriptions({ ...descriptions, [line.id]: e.target.value })
              }
            />
          </label>
          <label className="block">
            {t("Photo for")} {line.sku}
            <input
              className="mt-1 block w-full"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={evidence.length >= 5}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setError("");
                if (file.size > 5 * 1024 * 1024) {
                  setError("Each image must be 5 MB or smaller.");
                  return;
                }
                setUploading(true);
                onBusy(true);
                try {
                  const form = new FormData();
                  form.set("file", file);
                  const result = await secureApiFetch<
                    Omit<ReturnEvidence, "orderItemId">
                  >("customer", `/orders/${orderId}/return-attachments`, {
                    method: "POST",
                    body: form,
                  });
                  onEvidence([
                    ...evidence,
                    { ...result, orderItemId: line.id },
                  ]);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Unable to upload image.",
                  );
                } finally {
                  setUploading(false);
                  onBusy(false);
                }
              }}
            />
          </label>
          {evidence
            .filter((file) => file.orderItemId === line.id)
            .map((file) => (
              <p className="text-sm" key={file.mediaId}>
                {file.fileName} {t("— uploaded privately")}{" "}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={async () => {
                    setError("");
                    setUploading(true);
                    onBusy(true);
                    try {
                      await secureApiFetch(
                        "customer",
                        `/orders/${orderId}/return-attachments/${file.mediaId}`,
                        { method: "DELETE" },
                      );
                      onEvidence(
                        evidence.filter(
                          (item) => item.mediaId !== file.mediaId,
                        ),
                      );
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Unable to remove image",
                      );
                    } finally {
                      setUploading(false);
                      onBusy(false);
                    }
                  }}
                >
                  {t("Remove")}
                </button>
              </p>
            ))}
        </div>
      ))}
      {uploading && <p role="status">{t("Checking and uploading image…")}</p>}
    </fieldset>
  );
}

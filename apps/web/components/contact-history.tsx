"use client";
import { useUiText, useUiLocale } from "./ui-locale";

import { uiError } from "../lib/ui-i18n";
import { secureApiFetch } from "../lib/secure-api";
export type ContactEntry = {
  at: string;
  actorId?: string;
  action: string;
  text?: string;
  changes?: Record<string, unknown>;
};
export function ContactHistory({
  id,
  history,
  attachments,
}: {
  id: string;
  history: ContactEntry[];
  attachments: string[];
}) {
  const uiLocale = useUiLocale();

  const t = useUiText();

  async function download(mediaId: string) {
    const tab = window.open("about:blank", "_blank");
    try {
      const result = await secureApiFetch<{ url: string }>(
        "staff",
        `/contacts/${id}/attachments/${mediaId}`,
      );
      if (tab) {
        tab.opener = null;
        tab.location.href = `/api/v1${result.url}`;
      }
    } catch (error) {
      tab?.close();
      window.alert(uiError(uiLocale, error, "Download unavailable"));
    }
  }
  return (
    <div className="mt-5 space-y-4">
      {attachments.length > 0 && (
        <div>
          <h3 className="font-semibold">{t("Attachments")}</h3>
          <ul className="mt-2 flex flex-wrap gap-3">
            {attachments.map((mediaId, i) => (
              <li key={mediaId}>
                <button
                  className="rounded border px-3 py-2"
                  onClick={() => void download(mediaId)}
                >
                  {t("Open attachment")} {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary className="cursor-pointer font-semibold">
          {t("Request history ({count})", { count: history.length })}
        </summary>
        <ol className="mt-3 space-y-3">
          {history.map((entry, i) => (
            <li key={i} className="rounded border bg-neutral-50 p-3">
              <p className="text-sm font-semibold">
                {entry.action === "note"
                  ? t("Internal note")
                  : entry.action === "reply"
                    ? t("Customer email")
                    : t(entry.action)}{" "}
                · {new Date(entry.at).toLocaleString(uiLocale)}
              </p>
              {entry.text && (
                <p className="mt-2 whitespace-pre-wrap leading-7">
                  {entry.text}
                </p>
              )}
              {entry.changes && (
                <dl className="mt-2 text-sm">
                  {Object.entries(entry.changes).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt>{t(key)}:</dt>
                      <dd>
                        {["status", "priority"].includes(key)
                          ? t(String(value))
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

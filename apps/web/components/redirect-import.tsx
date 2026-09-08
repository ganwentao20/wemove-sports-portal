"use client";
import { uiError } from "../lib/ui-i18n";
import { useUiText, useUiLocale } from "./ui-locale";

import { useState } from "react";
import { secureApiFetch } from "../lib/secure-api";
export function RedirectImport({
  mfa,
  onSaved,
}: {
  mfa: string;
  onSaved: () => Promise<void>;
}) {
  const t = useUiText();
  const uiLocale = useUiLocale();

  const [rows, setRows] = useState<
      Array<{ source: string; destination: string; status: number }>
    >([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  function parse(text: string) {
    const lines = text
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines[0]?.toLowerCase().replaceAll('"', "").startsWith("source,"))
      lines.shift();
    if (!lines.length || lines.length > 500)
      throw new Error("Choose between 1 and 500 rows.");
    return lines.map((line, index) => {
      const cells = line
        .split(",")
        .map((value) => value.trim().replace(/^"(.*)"$/, "$1"));
      if (
        cells.length < 2 ||
        cells.length > 3 ||
        !cells[0].startsWith("/") ||
        !cells[1].startsWith("/") ||
        (cells[2] && !["301", "302"].includes(cells[2]))
      )
        throw new Error(
          `Invalid row ${index + 1}. Use source,destination,status; percent-encode commas in paths.`,
        );
      return {
        source: cells[0],
        destination: cells[1],
        status: Number(cells[2] || 301),
      };
    });
  }
  return (
    <section className="rounded-xl border p-5">
      <h2 className="text-xl font-bold">{t("Import redirects")}</h2>
      <p className="my-3 text-sm">
        {t(
          "CSV columns: source,destination,status. Review up to 500 rows before saving; invalid paths and cycles reject the entire import.",
        )}
      </p>
      <label>
        {t("Redirect CSV")}
        <input
          type="file"
          accept=".csv,text/csv"
          className="ml-3"
          onChange={async (event) => {
            setRows([]);
            setMessage("");
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 600000) throw new Error("CSV exceeds 600 KB.");
              setRows(parse(await file.text()));
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        />
      </label>
      <p role="status" className="my-3">
        {message ? uiError(uiLocale, message) : ""}
      </p>
      {rows.length > 0 && (
        <>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>{t("Source")}</th>
                  <th>{t("Destination")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td className="break-all p-2">{row.source}</td>
                    <td className="break-all p-2">{row.destination}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            disabled={busy}
            className="mt-4 rounded border px-4 py-2"
            onClick={async () => {
              setBusy(true);
              try {
                await secureApiFetch("staff", "/admin/seo/redirects/import", {
                  method: "POST",
                  headers: { "x-mfa-code": mfa },
                  body: JSON.stringify({ items: rows }),
                });
                setMessage(
                  t("{value1} redirects saved.", { value1: rows.length }),
                );
                setRows([]);
                await onSaved();
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Import")}
            {rows.length} {t("redirects")}
          </button>
        </>
      )}
    </section>
  );
}

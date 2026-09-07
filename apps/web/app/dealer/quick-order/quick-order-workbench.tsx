"use client";

import { recordEvent } from "../../../components/consent-analytics";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type ResultLine = {
  row: number;
  sku: string;
  quantity: number;
  ok: boolean;
  message?: string;
  productName?: string;
  unitPriceCents?: number;
  lineTotalCents?: number;
  available?: number | null;
  availability?: string;
  purchaseRules?: {
    moq: number;
    multiple: number;
    caseSize: number;
    leadTimeDays: number;
  };
};
type Preview = {
  valid: boolean;
  currency: string;
  totalCents: number;
  results: ResultLine[];
};

export function QuickOrderWorkbench() {
  const router = useRouter();
  const [raw, setRaw] = useState("\n");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [target, setTarget] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  async function createRequest() {
    if (!preview?.valid || !title.trim()) return;
    setBusy(true);
    setError("");
    try {
      await secureApiFetch("dealer", "/dealer/rfqs", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          note,
          targetDeliveryAt: target ? new Date(target).toISOString() : undefined,
          attachmentIds,
          lines: preview.results.map((line) => ({
            sku: line.sku,
            quantity: line.quantity,
          })),
        }),
      });
      recordEvent("request_quote", {
        channel: "B2B",
        items: preview.results.map((line) => ({
          sku: line.sku,
          qty: line.quantity,
        })),
      });
      router.push("/dealer/procurement");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function validate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setPreview(
        await secureApiFetch<Preview>("dealer", "/dealer/quick-order/csv", {
          method: "POST",
          body: JSON.stringify({ csv: raw.replace(/\t/g, ",") }),
        }),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("dealer").catch(() => undefined);
        router.replace("/dealer/login");
        return;
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to validate this order.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-10"
    >
      <p className="text-sm font-semibold text-[#2B5F8A]">APPROVED DEALER</p>
      <h1 className="mt-1 text-3xl font-bold">Quick Order</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Paste up to 100 rows as <code>SKU, quantity</code>. This validates
        authorization, tier pricing and live stock before an RFQ or PO is
        created.
      </p>
      <form onSubmit={validate} className="mt-6 space-y-4">
        <label className="block">
          Upload SKU CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="ml-3"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 100000) {
                  setError("CSV exceeds 100 KB");
                  return;
                }
                setRaw(await file.text());
                setPreview(null);
              }
            }}
          />
        </label>
        <button
          type="button"
          className="underline"
          onClick={async () => {
            try {
              const cart = await secureApiFetch<{
                lines: Array<{ sku: string; quantity: number }>;
              }>("dealer", "/dealer/cart");
              setRaw(
                cart.lines.map((l) => `${l.sku},${l.quantity}`).join("\n"),
              );
              setPreview(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Load saved procurement cart
        </button>
        <textarea
          required
          rows={10}
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setPreview(null);
          }}
          aria-label="SKU and quantity rows"
          placeholder={"WM-BALL-RED, 12\nWM-BALANCE-BLUE, 4"}
          className="w-full rounded-xl border border-neutral-300 p-4 font-mono text-sm"
        />
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="rounded-full bg-[var(--wm-dark)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Validating…" : "Validate order"}
        </button>
      </form>
      {preview && (
        <section className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200">
          <div
            className={`p-4 text-sm font-semibold ${preview.valid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
          >
            {preview.valid
              ? "All rows are ready for the next business-document step."
              : "Resolve the row errors before continuing."}{" "}
            Valid total: {preview.currency}{" "}
            {(preview.totalCents / 100).toFixed(2)}
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-3">Row</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Result</th>
                <th className="p-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.results.map((line) => (
                <tr key={line.row}>
                  <td className="p-3">{line.row}</td>
                  <td className="p-3 font-mono">{line.sku}</td>
                  <td className="p-3">{line.quantity}</td>
                  <td
                    className={`p-3 ${line.ok ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {line.ok
                      ? `${line.productName} · ${preview.currency} ${((line.unitPriceCents ?? 0) / 100).toFixed(2)} each · ${line.available == null ? line.availability : line.available + " available"} · lead time ${line.purchaseRules?.leadTimeDays ?? 0} days`
                      : line.message}
                  </td>
                  <td className="p-3">
                    {line.ok
                      ? `${preview.currency} ${((line.lineTotalCents ?? 0) / 100).toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {preview?.valid && (
        <section className="mt-6 rounded-xl border p-5">
          <h2 className="font-semibold">Request a sales quote</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Owners and buyers can save these items as a draft, then submit it
            for quotation.
          </p>
          <label className="mt-3 block text-sm">
            Request title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              className="mt-1 block w-full rounded border px-3 py-2"
              placeholder="September store replenishment"
            />
          </label>
          <button
            onClick={() => void createRequest()}
            disabled={busy || !title.trim()}
            className="mt-4 rounded-lg bg-[var(--wm-dark)] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Create RFQ draft
          </button>
          <label className="mt-3 block">
            Target delivery date
            <input
              type="date"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="ml-3 rounded border p-2"
            />
          </label>
          <label className="mt-3 block">
            Request notes
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="mt-3 block">
            RFQ attachment
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const form = new FormData();
                  form.set("file", file);
                  const result = await secureApiFetch<{ mediaId: string }>(
                    "dealer",
                    "/media/company-upload",
                    { method: "POST", body: form },
                  );
                  setAttachmentIds((v) => [...v, result.mediaId]);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          </label>
          <p className="text-sm">
            {attachmentIds.length} attachment(s) uploaded.
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 ml-3 underline"
            onClick={async () => {
              try {
                await secureApiFetch("dealer", "/dealer/cart", {
                  method: "PUT",
                  body: JSON.stringify({
                    lines: preview.results.map((l) => ({
                      sku: l.sku,
                      quantity: l.quantity,
                    })),
                  }),
                });
                setError("Procurement cart saved.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Save procurement cart
          </button>
        </section>
      )}
    </main>
  );
}

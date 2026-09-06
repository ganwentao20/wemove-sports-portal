"use client";

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
  available?: number;
};
type Preview = { valid: boolean; totalCents: number; results: ResultLine[] };

export function QuickOrderWorkbench() {
  const router = useRouter();
  const [raw, setRaw] = useState("\n");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function validate(event: FormEvent) {
    event.preventDefault();
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [sku = "", quantity = ""] = line
          .split(/[,\t]/)
          .map((value) => value.trim());
        return { sku, quantity: Number(quantity) };
      });
    setBusy(true);
    setError("");
    try {
      setPreview(
        await secureApiFetch<Preview>(
          "dealer",
          "/dealer/quick-order/validate",
          { method: "POST", body: JSON.stringify({ lines }) },
        ),
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm font-semibold text-[#2B5F8A]">APPROVED DEALER</p>
      <h1 className="mt-1 text-3xl font-bold">Quick Order</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Paste up to 100 rows as <code>SKU, quantity</code>. This validates
        authorization, tier pricing and live stock before an RFQ or PO is
        created.
      </p>
      <form onSubmit={validate} className="mt-6 space-y-4">
        <textarea
          required
          rows={10}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
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
            Valid total: ${(preview.totalCents / 100).toFixed(2)}
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
                      ? `${line.productName} · $${((line.unitPriceCents ?? 0) / 100).toFixed(2)} each · ${line.available} available`
                      : line.message}
                  </td>
                  <td className="p-3">
                    {line.ok
                      ? `$${((line.lineTotalCents ?? 0) / 100).toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

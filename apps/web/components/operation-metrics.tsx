"use client";
type Row = Record<string, unknown>;
const labels: Record<string, string> = {
  vitals: "Consented field performance",
  products: "Products",
  content: "Content",
  search: "Search",
  sales: "Sales",
  dealer: "Dealers",
  lead: "Support leads",
};
export function OperationMetrics({
  metrics,
  mfa,
}: {
  metrics: Record<string, Row[]>;
  mfa: string;
}) {
  async function download() {
    const response = await fetch("/api/secure/staff/admin/reports/export", {
      headers: { "x-wemove-csrf": "1", "x-mfa-code": mfa },
    });
    if (!response.ok)
      throw new Error(
        "Report download failed. Check your permission and MFA code.",
      );
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "operations-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="space-y-6">
      <p className="text-sm leading-6">
        All measures below cover the last 30 days. Rates are percentages; blank
        means no eligible denominator. Product rates count consenting browser
        sessions, and assisted conversions match later purchases within that
        session. Sales use payment records and stay separate for each currency.
        Non-consenting visits are excluded from behavior reports.
      </p>
      <button
        className="rounded-lg border px-4 py-2"
        onClick={() =>
          void download().catch((error) => window.alert(error.message))
        }
      >
        Download report CSV
      </button>
      {Object.entries(metrics).map(([group, rows]) => {
        const columns = Array.from(
          new Set(rows.flatMap((row) => Object.keys(row))),
        );
        return (
          <section key={group} className="rounded-xl border p-5">
            <h2 className="mb-4 text-xl font-bold">{labels[group] ?? group}</h2>
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {columns.map((key) => (
                        <th key={key} className="whitespace-nowrap p-2">
                          {key.replace(/([a-z])([A-Z])/g, "$1 $2")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {columns.map((key) => (
                          <td key={key} className="max-w-xs break-words p-2">
                            {row[key] === null || row[key] === undefined
                              ? "—"
                              : typeof row[key] === "number"
                                ? Number(row[key]).toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  })
                                : String(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No matching activity in this period.</p>
            )}
          </section>
        );
      })}
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { secureApiFetch } from "../../../lib/secure-api";
import { ApiError } from "../../../lib/api";
type Dashboard = {
  company: {
    companyName: string;
    status: string;
    country: string;
    role: string;
    profile: Record<string, string>;
    purchaseSettings: Record<string, unknown>;
    catalogPolicy: { markets?: string[] };
    tier: { name: string; code: string } | null;
  };
  counts: {
    pendingQuotes: number;
    awaitingReview: number;
    unpaidOrders: number;
  };
  quotes: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    quotes: Array<{ validUntil: string; totalCents: number; currency: string }>;
  }>;
  orders: Array<{
    id: string;
    orderNo: string;
    status: string;
    paymentStatus: string;
    currency: string;
    totalCents: number;
    createdAt: string;
  }>;
};
type Download = {
  id: string;
  fileName: string;
  version: number;
  sizeBytes: number;
};
const linkStyle =
  "rounded-xl border border-neutral-200 bg-white p-4 text-sm font-semibold hover:border-sky-500";
export function DealerDashboard({
  announcements,
}: {
  announcements: Array<{ id: string; title: string; href?: string }>;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [files, setFiles] = useState<Download[]>([]),
    [error, setError] = useState(""),
    [downloadError, setDownloadError] = useState(""),
    [login, setLogin] = useState(false);
  useEffect(() => {
    let current = true;
    void secureApiFetch<Dashboard>("dealer", "/dealer/dashboard")
      .then((value) => {
        if (current) setData(value);
        return secureApiFetch<Download[]>("dealer", "/media/downloads");
      })
      .then((value) => {
        if (current) setFiles(value.slice(0, 5));
      })
      .catch((cause) => {
        if (!current) return;
        setError((cause as Error).message);
        setLogin(cause instanceof ApiError && cause.status === 401);
      });
    return () => {
      current = false;
    };
  }, []);
  async function download(id: string) {
    try {
      const result = await secureApiFetch<{ url: string }>(
        "dealer",
        "/media/" + id + "/access",
      );
      window.open("/api/v1" + result.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setDownloadError((cause as Error).message);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl space-y-7 px-4 py-10"
    >
      <div>
        <p className="text-sm font-semibold text-sky-800">DEALER CENTER</p>
        <h1 className="mt-1 text-3xl font-bold">
          {data?.company.profile.displayName ||
            data?.company.companyName ||
            "Dealer Dashboard"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Review company orders, quotations and purchasing resources.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
          {login && (
            <>
              {" "}
              <Link href="/dealer/login" className="underline">
                Dealer login
              </Link>
            </>
          )}
        </p>
      )}
      {!data && !error && <p role="status">Loading company dashboard…</p>}
      {data && (
        <>
          <section
            className="grid gap-4 rounded-xl bg-sky-50 p-5 text-sm sm:grid-cols-3"
            aria-label="Company account"
          >
            <p>
              Status: <strong>{data.company.status}</strong>
              <br />
              Role: {data.company.role}
            </p>
            <p>
              Price level:{" "}
              <strong>
                {data.company.tier?.name ?? "Default dealer pricing"}
              </strong>
              <br />
              Currency:{" "}
              {String(data.company.purchaseSettings.currency ?? "USD")}
            </p>
            <p>
              Sales region:{" "}
              <strong>
                {data.company.profile.salesRegion ||
                  data.company.catalogPolicy.markets?.join(", ") ||
                  data.company.country}
              </strong>
              <br />
              Business contact:{" "}
              {data.company.profile.salesRepresentative ||
                data.company.profile.salesContact ||
                "Contact platform support"}
            </p>
          </section>
          <section
            className="grid gap-4 sm:grid-cols-3"
            aria-label="Business overview"
          >
            {(
              [
                ["Quotes awaiting a decision", data.counts.pendingQuotes],
                ["Orders awaiting confirmation", data.counts.awaitingReview],
                ["Orders awaiting payment", data.counts.unpaidOrders],
              ] as const
            ).map(([title, count]) => (
              <Link
                href="/dealer/procurement"
                key={title}
                className={linkStyle}
              >
                <span className="block text-3xl">{count}</span>
                <span>{title}</span>
              </Link>
            ))}
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border p-5">
              <h2 className="text-xl font-semibold">Quotations to review</h2>
              {data.quotes.length ? (
                <ul className="mt-3 divide-y">
                  {data.quotes.map((quote) => {
                    const latest = quote.quotes[0];
                    const expired =
                      quote.status === "QUOTED" &&
                      latest &&
                      new Date(latest.validUntil).getTime() <= Date.now();
                    return (
                      <li key={quote.id} className="py-3">
                        <Link
                          href="/dealer/procurement"
                          className="font-medium underline"
                        >
                          {quote.title}
                        </Link>
                        <p className="text-sm text-neutral-600">
                          {expired ? "EXPIRED" : quote.status}
                          {latest
                            ? " · " +
                              latest.currency +
                              " " +
                              (latest.totalCents / 100).toFixed(2) +
                              " · valid until " +
                              new Date(latest.validUntil).toLocaleDateString()
                            : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  No pending quotations.
                </p>
              )}
            </section>
            <section className="rounded-xl border p-5">
              <h2 className="text-xl font-semibold">Recent orders</h2>
              {data.orders.length ? (
                <ul className="mt-3 divide-y">
                  {data.orders.map((order) => (
                    <li key={order.id} className="py-3">
                      <Link
                        href="/dealer/procurement"
                        className="font-medium underline"
                      >
                        {order.orderNo}
                      </Link>
                      <p className="text-sm text-neutral-600">
                        {order.status} · {order.paymentStatus} ·{" "}
                        {order.currency} {(order.totalCents / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">No orders yet.</p>
              )}
            </section>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border p-5">
              <h2 className="text-xl font-semibold">
                Latest company resources
              </h2>
              {files.length ? (
                <ul className="mt-3 divide-y">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex justify-between gap-4 py-3"
                    >
                      <span>
                        {file.fileName}
                        <span className="block text-xs text-neutral-500">
                          Version {file.version} ·{" "}
                          {Math.ceil(file.sizeBytes / 1024)} KB
                        </span>
                      </span>
                      <button
                        onClick={() => void download(file.id)}
                        className="text-sm underline"
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  No authorized resources published yet.
                </p>
              )}
              {downloadError && <p role="alert">{downloadError}</p>}
            </section>
            <section className="rounded-xl border p-5">
              <h2 className="text-xl font-semibold">Platform announcements</h2>
              {announcements.length ? (
                <ul className="mt-3 space-y-3">
                  {announcements.map((item) => (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} className="underline">
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  No current announcements.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      <nav
        aria-label="Dealer tools"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {[
          ["Authorized catalog & prices", "/dealer/catalog"],
          ["Quick order & procurement cart", "/dealer/quick-order"],
          ["Quotes & purchase orders", "/dealer/procurement"],
          ["Authorized downloads", "/dealer/downloads"],
          ["Company, team & addresses", "/dealer/company"],
          ["Account security", "/dealer/security"],
        ].map(([label, href]) => (
          <Link href={href} key={href} className={linkStyle}>
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

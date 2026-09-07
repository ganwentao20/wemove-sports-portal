"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "../lib/api";
import { secureApiFetch } from "../lib/secure-api";

// M1/MB：甘文韬负责的询报价、企业 PO 与价格表授权工作台。
type Item = {
  sku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineCents: number;
};
type Quote = {
  version: number;
  items: Item[];
  totalCents: number;
  taxCents: number;
  shippingCents: number;
  validUntil: string;
};
type Order = {
  id: string;
  orderNo: string;
  companyName: string;
  status: string;
  quoteVersion: number;
  items: Item[];
  totalCents: number;
  taxCents: number;
  shippingCents: number;
  shippingAddress: Record<string, string>;
};
type Rfq = {
  id: string;
  title: string;
  note?: string;
  status: string;
  revision: number;
  items: Item[];
  quotes: Quote[];
  company?: { companyName: string };
  purchaseOrder: Order | null;
};
type Books = {
  books: Array<{ id: string; code: string; label: string }>;
  companies: Array<{
    id: string;
    companyName: string;
    priceBooks: Array<{ bookId: string }>;
  }>;
};
type Action = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<boolean>;
const input =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-lg bg-[var(--wm-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const money = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
const nextStates: Record<string, string[]> = {
  PENDING_REVIEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["COMPLETED"],
};

function Lines({ items }: { items: Item[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50">
          <tr>
            {["Product / SKU", "Quantity", "Unit price", "Total"].map(
              (label) => (
                <th key={label} className="p-3">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sku} className="border-b">
              <td className="p-3">
                {item.productName}
                <br />
                <span className="font-mono text-xs text-neutral-500">
                  {item.sku}
                </span>
              </td>
              <td className="p-3">{item.quantity}</td>
              <td className="p-3 whitespace-nowrap">
                {money(item.unitPriceCents)}
              </td>
              <td className="p-3 whitespace-nowrap">{money(item.lineCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuoteForm({
  rfq,
  act,
  busy,
}: {
  rfq: Rfq;
  act: Action;
  busy: boolean;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await act(`/rfqs/${rfq.id}/quotes`, {
      revision: rfq.revision,
      lines: rfq.items.map((item) => ({
        sku: item.sku,
        unitPriceCents: Math.round(Number(data.get(item.sku)) * 100),
      })),
      taxCents: Math.round(Number(data.get("tax")) * 100),
      shippingCents: Math.round(Number(data.get("shipping")) * 100),
      validUntil: new Date(String(data.get("validUntil"))).toISOString(),
    });
  }
  return (
    <form onSubmit={submit} className="mt-5 rounded-lg bg-neutral-50 p-4">
      <h3 className="font-semibold">
        {rfq.revision ? "Issue a revised quote" : "Prepare quote"}
      </h3>
      <p className="mt-1 text-sm text-neutral-600">
        Prices are in USD. Existing quote versions remain available for
        reference.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rfq.items.map((item) => (
          <label key={item.sku} className="text-sm">
            {item.sku} · unit price
            <input
              name={item.sku}
              type="number"
              min="0"
              max="21474836.47"
              step="0.01"
              required
              defaultValue={(
                (rfq.quotes[0]?.items.find((line) => line.sku === item.sku)
                  ?.unitPriceCents ?? item.unitPriceCents) / 100
              ).toFixed(2)}
              className={input}
            />
          </label>
        ))}
        <label className="text-sm">
          Tax (USD)
          <input
            name="tax"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
            className={input}
          />
        </label>
        <label className="text-sm">
          Shipping (USD)
          <input
            name="shipping"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
            className={input}
          />
        </label>
        <label className="text-sm">
          Valid until (your local time)
          <input
            name="validUntil"
            type="datetime-local"
            required
            className={input}
          />
        </label>
      </div>
      <button disabled={busy} className={`${button} mt-4`}>
        Issue quote version {rfq.revision + 1}
      </button>
    </form>
  );
}

function AcceptForm({
  rfq,
  act,
  busy,
}: {
  rfq: Rfq;
  act: Action;
  busy: boolean;
}) {
  const [opened, setOpened] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shippingAddress = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    shippingAddress.country = String(shippingAddress.country).toUpperCase();
    await act(`/rfqs/${rfq.id}/accept`, {
      version: rfq.revision,
      shippingAddress,
    });
  }
  if (!opened)
    return (
      <button
        onClick={() => setOpened(true)}
        disabled={busy}
        className={button}
      >
        Accept quote &amp; create purchase order
      </button>
    );
  return (
    <form onSubmit={submit} className="mt-3 w-full rounded-lg bg-blue-50 p-4">
      <h3 className="font-semibold">Delivery details</h3>
      <p className="mt-1 text-sm">
        Accepting version {rfq.revision} creates one purchase order and reserves
        stock. Total: {money(rfq.quotes[0].totalCents)}.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          ["recipient", "Recipient", 100],
          ["phone", "Phone", 40],
          ["country", "Country code (e.g. US)", 2],
          ["city", "City", 100],
          ["addressLine", "Street address", 300],
          ["postalCode", "Postal code", 24],
        ].map(([name, label, max]) => (
          <label key={name} className="text-sm">
            {label}
            <input
              name={String(name)}
              required
              minLength={name === "phone" ? 3 : name === "country" ? 2 : 1}
              maxLength={Number(max)}
              className={input}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <button disabled={busy} className={button}>
          Confirm purchase order
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpened(false)}
          className="text-sm underline"
        >
          Back
        </button>
      </div>
    </form>
  );
}

function PriceBooks({
  books,
  act,
  busy,
}: {
  books: Books;
  act: Action;
  busy: boolean;
}) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await act("/price-books", Object.fromEntries(data))) form.reset();
  }
  return (
    <section className="mt-8 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">Company price books</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Assign approved companies to price books. Rules attached to unassigned
        books never enter their dealer price calculation.
      </p>
      <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Book code
          <input name="code" required maxLength={64} className={input} />
        </label>
        <label className="text-sm">
          Book label
          <input name="label" required maxLength={160} className={input} />
        </label>
        <button disabled={busy} className={button}>
          Create book
        </button>
      </form>
      <div className="mt-5 space-y-4">
        {books.companies.map((company) => (
          <form
            key={`${company.id}-${company.priceBooks.map((book) => book.bookId).join()}`}
            onSubmit={async (event) => {
              event.preventDefault();
              const bookIds = new FormData(event.currentTarget).getAll(
                "bookIds",
              );
              await act(
                `/companies/${company.id}/price-books`,
                { bookIds },
                "PUT",
              );
            }}
            className="rounded-lg bg-neutral-50 p-4"
          >
            <h3 className="font-semibold">{company.companyName}</h3>
            <div className="my-3 flex flex-wrap gap-4">
              {books.books.length === 0 && (
                <p className="text-sm">Create a price book first.</p>
              )}
              {books.books.map((book) => (
                <label key={book.id} className="text-sm">
                  <input
                    type="checkbox"
                    name="bookIds"
                    value={book.id}
                    defaultChecked={company.priceBooks.some(
                      (assigned) => assigned.bookId === book.id,
                    )}
                    className="mr-2"
                  />
                  {book.label} ({book.code})
                </label>
              ))}
            </div>
            <button disabled={busy} className={button}>
              Save company access
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

export function B2bWorkbench({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const kind = admin ? "staff" : "dealer";
  const base = admin ? "/admin/b2b" : "/dealer";
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [books, setBooks] = useState<Books>({ books: [], companies: [] });
  const [canBuy, setCanBuy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mfa, setMfa] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [rfqResult, orderResult] = await Promise.all([
      secureApiFetch<Rfq[] | { items: Rfq[]; company: { role: string } }>(
        kind,
        `${base}/rfqs`,
      ),
      secureApiFetch<Order[]>(kind, `${base}/purchase-orders`),
    ]);
    setRfqs(Array.isArray(rfqResult) ? rfqResult : rfqResult.items);
    setCanBuy(!Array.isArray(rfqResult) && rfqResult.company.role !== "VIEWER");
    setOrders(orderResult);
    if (admin)
      setBooks(await secureApiFetch<Books>(kind, `${base}/price-books`));
  }, [admin, base, kind]);
  const handleError = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401)
        router.replace(admin ? "/admin/login" : "/dealer/login");
      setError(
        cause instanceof Error
          ? cause.message
          : "Request failed. Please try again.",
      );
    },
    [admin, router],
  );
  useEffect(() => {
    void load()
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [load, handleError]);
  const act: Action = async (path, body = {}, method = "POST") => {
    if (admin && !/^\d{6}$/.test(mfa)) {
      setError("Enter your current 6-digit MFA code before saving.");
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await secureApiFetch(kind, base + path, {
        method,
        body: JSON.stringify(body),
        headers: admin ? { "x-mfa-code": mfa } : undefined,
      });
      setNotice("Saved successfully.");
      setMfa("");
      await load();
      return true;
    } catch (cause) {
      handleError(cause);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">
            WEMOVE {admin ? "ADMIN" : "DEALER"}
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {admin ? "B2B sales & fulfillment" : "Quotes & purchase orders"}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Track requests, compare quote versions and follow company purchases.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={admin ? "/admin/dashboard" : "/dealer/dashboard"}
            className="text-sm underline"
          >
            Dashboard
          </Link>
          {!admin && (
            <Link href="/dealer/quick-order" className={button}>
              New request
            </Link>
          )}
          <button
            disabled={busy || loading}
            onClick={() => {
              setError("");
              void load().catch(handleError);
            }}
            className="text-sm underline"
          >
            Refresh
          </button>
        </div>
      </div>
      {admin && (
        <label className="mt-6 block max-w-xs text-sm">
          Current MFA code
          <input
            value={mfa}
            onChange={(event) =>
              setMfa(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className={input}
          />
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p className="mt-8">Loading company documents…</p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Requests for quotation</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Latest 100 requests. Amounts use USD.
            </p>
            {!rfqs.length && (
              <p className="mt-4 rounded-lg border border-dashed p-6">
                No RFQs yet. Start from Quick Order to validate your items.
              </p>
            )}
            <div className="mt-4 space-y-5">
              {rfqs.map((rfq) => (
                <article
                  key={rfq.id}
                  className="rounded-xl border border-neutral-200 p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{rfq.title}</h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        {rfq.company?.companyName} · {rfq.id}
                      </p>
                    </div>
                    <span className="self-start rounded bg-neutral-100 px-3 py-1 text-xs font-semibold">
                      {rfq.status}
                    </span>
                  </div>
                  {rfq.note && <p className="mt-3 text-sm">{rfq.note}</p>}
                  <Lines items={rfq.quotes[0]?.items ?? rfq.items} />
                  {!rfq.quotes.length && (
                    <p className="mt-2 text-xs text-neutral-500">
                      Estimated dealer prices; a sales quote is required before
                      purchase.
                    </p>
                  )}
                  {rfq.quotes.map((quote, index) => (
                    <details
                      key={quote.version}
                      open={index === 0}
                      className="mt-3 rounded border p-3"
                    >
                      <summary className="cursor-pointer text-sm font-medium">
                        Version {quote.version}
                        {index === 0 ? " · Latest" : " · Historical"} ·{" "}
                        {money(quote.totalCents)} · valid until{" "}
                        {new Date(quote.validUntil).toLocaleString()}
                      </summary>
                      <p className="mt-2 text-sm">
                        Tax {money(quote.taxCents)} · Shipping{" "}
                        {money(quote.shippingCents)}
                      </p>
                      {index > 0 && <Lines items={quote.items} />}
                    </details>
                  ))}
                  {admin && ["SUBMITTED", "QUOTED"].includes(rfq.status) && (
                    <QuoteForm
                      key={`${rfq.id}-${rfq.revision}`}
                      rfq={rfq}
                      act={act}
                      busy={busy}
                    />
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {!admin && canBuy && rfq.status === "DRAFT" && (
                      <button
                        disabled={busy}
                        onClick={() => void act(`/rfqs/${rfq.id}/submit`)}
                        className={button}
                      >
                        Submit for quotation
                      </button>
                    )}
                    {!admin && canBuy && rfq.status === "QUOTED" && (
                      <>
                        <AcceptForm rfq={rfq} act={act} busy={busy} />
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Reject this quote? This closes the RFQ.",
                              )
                            )
                              void act(`/rfqs/${rfq.id}/reject`, {
                                version: rfq.revision,
                              });
                          }}
                          className="rounded border border-red-300 px-4 py-2 text-sm text-red-700"
                        >
                          Reject quote
                        </button>
                      </>
                    )}
                    {rfq.purchaseOrder && (
                      <a
                        href={`#po-${rfq.purchaseOrder.id}`}
                        className="text-sm underline"
                      >
                        View purchase order {rfq.purchaseOrder.orderNo}
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Purchase orders</h2>
            {!orders.length && (
              <p className="mt-4 rounded-lg border border-dashed p-6">
                No purchase orders yet. Accept a valid quote to create one.
              </p>
            )}
            <div className="mt-4 space-y-5">
              {orders.map((order) => (
                <article
                  id={`po-${order.id}`}
                  key={order.id}
                  className="rounded-xl border p-5"
                >
                  <h3 className="break-all font-semibold">{order.orderNo}</h3>
                  <p className="mt-2 text-sm">
                    {order.companyName} · {order.status} · Quote v
                    {order.quoteVersion}
                  </p>
                  <Lines items={order.items} />
                  <p className="mt-3 text-right font-semibold">
                    Total {money(order.totalCents)}
                  </p>
                  <p className="mt-1 text-right text-sm">
                    Includes tax {money(order.taxCents)} and shipping{" "}
                    {money(order.shippingCents)}
                  </p>
                  <p className="mt-3 text-sm text-neutral-600">
                    Deliver to:{" "}
                    {Object.values(order.shippingAddress).join(", ")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {(admin
                      ? (nextStates[order.status] ?? [])
                      : canBuy && order.status === "PENDING_REVIEW"
                        ? ["CANCELLED"]
                        : []
                    ).map((status) => (
                      <button
                        key={status}
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Change purchase order to ${status}?`,
                            )
                          )
                            void act(
                              `/purchase-orders/${order.id}/${admin ? "status" : "cancel"}`,
                              admin ? { status } : {},
                              "PATCH",
                            );
                        }}
                        className={button}
                      >
                        {status === "CANCELLED"
                          ? "Cancel order"
                          : `Mark ${status.toLowerCase()}`}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
          {admin && <PriceBooks books={books} act={act} busy={busy} />}
        </>
      )}
    </main>
  );
}

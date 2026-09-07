"use client";
import Link from "next/link";
import {
  ReturnEvidenceFields,
  type ReturnEvidence,
} from "./return-evidence-fields";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { secureApiFetch } from "../lib/secure-api";
import { recordEvent } from "./consent-analytics";
type Line = {
  variant?: { productId: string } | null;
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineCents: number;
  shippedQuantity: number;
  returnedQuantity: number;
};
type Return = {
  description?: string;
  attachments?: Array<{
    mediaId: string;
    orderItemId: string;
    fileName: string;
  }>;
  id: string;
  reason: string;
  resolution: string;
  status: string;
  staffNote?: string;
  items: Array<{ orderItemId: string; quantity: number; description?: string }>;
};
type Order = {
  history?: Array<{ action: string; createdAt: string; reason?: string }>;
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingAddress: Record<string, string>;
  billingAddress: Record<string, string>;
  reservationExpiresAt?: string;
  items: Line[];
  payments: Array<{
    id: string;
    mode: string;
    status: string;
    providerReference?: string;
    checkoutUrl?: string;
  }>;
  shipments: Array<{
    id: string;
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
    createdAt: string;
    items: Array<{ orderItemId: string; quantity: number }>;
  }>;
  returns: Return[];
  refunds: Array<{
    id: string;
    amountCents: number;
    status: string;
    reason: string;
    providerReference?: string;
  }>;
};
const input = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
const button =
  "rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-40";
export function RetailOrder({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const Container = admin ? "main" : "div";
  const requestKeys = useRef<Record<string, string>>({});
  const kind = admin ? "staff" : "customer";
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("REFUND");
  const [description, setDescription] = useState(""),
    [evidence, setEvidence] = useState<ReturnEvidence[]>([]),
    [descriptions, setDescriptions] = useState<Record<string, string>>({}),
    [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [cancelReason, setCancelReason] = useState("Changed my mind");
  const money = (cents: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: order?.currency ?? "USD",
    }).format(cents / 100);
  const load = useCallback(async () => {
    try {
      setOrder(
        await secureApiFetch<Order>(
          kind,
          admin ? `/admin/commerce/orders/${id}` : `/orders/${id}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, admin, kind]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (admin || order?.paymentStatus !== "PAID") return;
    const key = `wm_purchase_${order.id}`;
    if (!sessionStorage.getItem(key)) {
      const items = new Map<string, { quantity: number; value: number }>();
      for (const line of order.items) {
        const productId = line.variant?.productId;
        if (!productId) continue;
        const existing = items.get(productId) ?? { quantity: 0, value: 0 };
        existing.quantity += line.quantity;
        existing.value += line.lineCents;
        items.set(productId, existing);
      }
      for (const [product_id, item] of items)
        recordEvent("purchase", {
          order_id: order.id,
          product_id,
          ...item,
          revenue: item.value / 100,
          channel: "B2C",
          currency: order.currency,
        });
      sessionStorage.setItem(key, "1");
    }
  }, [admin, order]);
  async function perform(path: string, body: unknown = {}, method = "POST") {
    let requestIdentity = "";
    if (body && typeof body === "object" && "idempotencyKey" in body) {
      const { idempotencyKey: _, ...rest } = body as Record<string, unknown>;
      requestIdentity = path + JSON.stringify(rest);
      requestKeys.current[requestIdentity] ??= crypto.randomUUID();
      body = { ...rest, idempotencyKey: requestKeys.current[requestIdentity] };
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await secureApiFetch<any>(kind, path, {
        method,
        headers: admin ? { "x-mfa-code": mfa } : undefined,
        body: JSON.stringify(body),
      });
      await load();
      if (requestIdentity) delete requestKeys.current[requestIdentity];
      setNotice("Saved successfully.");
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function payment() {
    const result = await perform(`/orders/${id}/payment-session`, {
      idempotencyKey: crypto.randomUUID(),
    });
    if (result?.checkoutUrl && /^https:\/\//.test(result.checkoutUrl))
      window.location.assign(result.checkoutUrl);
  }
  function selectedLines() {
    return Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
  }
  async function shipment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await perform(`/admin/commerce/orders/${id}/shipments`, {
      idempotencyKey: crypto.randomUUID(),
      carrier: data.get("carrier"),
      trackingNumber: data.get("trackingNumber"),
      trackingUrl: data.get("trackingUrl") || undefined,
      items: selectedLines(),
    });
    setQuantities({});
  }
  async function returnRequest(e: FormEvent) {
    e.preventDefault();
    const selected = selectedLines();
    const saved = await perform(`/orders/${id}/returns`, {
      reason,
      description,
      resolution,
      attachments: evidence
        .filter((file) =>
          selected.some((line) => line.orderItemId === file.orderItemId),
        )
        .map(({ mediaId, attachmentToken, orderItemId }) => ({
          mediaId,
          attachmentToken,
          orderItemId,
        })),
      items: selected.map((line) => ({
        ...line,
        description: descriptions[line.orderItemId] ?? "",
      })),
    });
    if (saved) {
      setEvidence([]);
      setDescriptions({});
      setDescription("");
      setQuantities({});
    }
  }
  async function refund(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await perform(`/admin/commerce/orders/${id}/refunds`, {
      idempotencyKey: crypto.randomUUID(),
      amountCents: Math.round(Number(f.get("amount")) * 100),
      reason: f.get("reason"),
      returnId: f.get("returnId") || undefined,
    });
  }
  async function document(kindName: string) {
    setError("");
    try {
      const response = await fetch(
        `/api/secure/${kind}${admin ? "/admin/commerce" : ""}/orders/${id}/documents/${kindName}/pdf`,
        {
          headers: { "x-wemove-csrf": "1", Accept: "application/pdf" },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.message ?? `Document unavailable (${response.status})`,
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${order?.orderNo ?? id}-${kindName}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!order)
    return (
      <Container
        id={admin ? "main-content" : undefined}
        tabIndex={admin ? -1 : undefined}
        className="mx-auto max-w-6xl p-8"
      >
        <h1 className="text-3xl font-bold">Order details</h1>
        <p role={error ? "alert" : "status"} className="mt-5">
          {error || "Loading order…"}
        </p>
      </Container>
    );
  const pending = order.payments.find((p) => p.status === "PENDING");
  return (
    <Container
      id={admin ? "main-content" : undefined}
      tabIndex={admin ? -1 : undefined}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <Link
        href={admin ? "/admin/orders" : "/customer/account"}
        className="text-sm underline"
      >
        Back to {admin ? "orders" : "account"}
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{order.orderNo}</h1>
          <p className="mt-2">
            {order.status} · Payment {order.paymentStatus}
          </p>
        </div>
        <strong className="text-2xl">{money(order.totalCents)}</strong>
      </div>
      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-green-50 p-4 text-green-900"
        >
          {notice}
        </p>
      )}
      {admin && (
        <label className="mt-5 block max-w-xs">
          Current MFA code
          <input
            className={input}
            inputMode="numeric"
            maxLength={6}
            value={mfa}
            onChange={(e) => setMfa(e.target.value)}
          />
        </label>
      )}
      <section className="mt-7 grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl border p-5">
          <h2 className="font-bold">Shipping address</h2>
          <p className="mt-2 whitespace-pre-line text-sm">
            {Object.values(order.shippingAddress).filter(Boolean).join("\n")}
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <h2 className="font-bold">Charges</h2>
          <dl className="mt-2 space-y-2 text-sm">
            {[
              ["Subtotal", order.subtotalCents],
              ["Discount", -order.discountCents],
              ["Shipping", order.shippingCents],
              ["Tax", order.taxCents],
            ].map(([label, value]) => (
              <div className="flex justify-between" key={label}>
                <dt>{label}</dt>
                <dd>{money(Number(value))}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="mt-7">
        <h2 className="text-xl font-bold">Order items</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Product</th>
                <th>Ordered</th>
                <th>Shipped</th>
                <th>Returned</th>
                <th>{admin ? "Ship quantity" : "Return quantity"}</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="p-3">
                    {line.productName}
                    <span className="block text-neutral-500">{line.sku}</span>
                  </td>
                  <td>{line.quantity}</td>
                  <td>{line.shippedQuantity}</td>
                  <td>{line.returnedQuantity}</td>
                  <td>
                    <label className="sr-only" htmlFor={`qty-${line.id}`}>
                      {admin ? "Ship" : "Return"} {line.sku} quantity
                    </label>
                    <input
                      id={`qty-${line.id}`}
                      className="w-20 rounded border p-2"
                      type="number"
                      min={0}
                      max={
                        admin
                          ? line.quantity - line.shippedQuantity
                          : line.shippedQuantity - line.returnedQuantity
                      }
                      value={quantities[line.id] ?? 0}
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [line.id]: Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>{money(line.lineCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {!admin && order.status === "PENDING" && (
        <section className="mt-7 rounded-xl border p-5">
          <h2 className="text-xl font-bold">Payment</h2>
          {order.reservationExpiresAt && (
            <p className="mt-2 text-sm">
              Inventory held until{" "}
              {new Date(order.reservationExpiresAt).toLocaleString()}. Unpaid
              orders expire automatically.
            </p>
          )}
          {pending?.mode === "DEMO" ? (
            <>
              <p className="my-4 font-semibold text-amber-900">
                Demo payment session. No real money is charged.
              </p>
              <div className="flex flex-wrap gap-3">
                {["SUCCEEDED", "FAILED", "CANCELLED"].map((s) => (
                  <button
                    className={button}
                    key={s}
                    disabled={busy}
                    onClick={() =>
                      void perform(`/orders/payments/${pending.id}/demo`, {
                        status: s,
                      })
                    }
                  >
                    {s === "SUCCEEDED"
                      ? "Simulate success"
                      : s === "FAILED"
                        ? "Simulate failure"
                        : "Cancel payment"}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              className={`${button} mt-4`}
              disabled={busy}
              onClick={() => void payment()}
            >
              {pending?.checkoutUrl ? "Continue payment" : "Start payment"}
            </button>
          )}
          <label className="mt-4 block text-sm">
            Cancellation reason
            <select
              className={input}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            >
              {[
                "Changed my mind",
                "Incorrect delivery address",
                "Ordered the wrong items",
                "Delivery estimate is too long",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <button
            className={`${button} mt-4 ml-3`}
            disabled={busy}
            onClick={() =>
              void perform(
                `/orders/${id}/cancel`,
                { reason: cancelReason },
                "PATCH",
              )
            }
          >
            Cancel unpaid order
          </button>
        </section>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {["invoice", "receipt", "packing-list"].map((d) => (
          <button key={d} className={button} onClick={() => void document(d)}>
            Download {d.replace("-", " ")}
          </button>
        ))}
        {!admin && (
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void perform(`/orders/${id}/reorder`).then((result) => {
                if (result) window.location.assign("/checkout");
              })
            }
          >
            Reorder at current prices
          </button>
        )}
      </div>
      {admin && order.status === "CONFIRMED" && (
        <form
          onSubmit={shipment}
          className="mt-7 space-y-3 rounded-xl border p-5"
        >
          <h2 className="text-xl font-bold">Create a shipment</h2>
          <p className="text-sm">
            Select quantities above. Each shipment removes only those reserved
            units.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              Carrier
              <input className={input} name="carrier" required />
            </label>
            <label>
              Tracking number
              <input className={input} name="trackingNumber" required />
            </label>
            <label>
              Tracking URL (optional)
              <input className={input} name="trackingUrl" type="url" />
            </label>
          </div>
          <button className={button} disabled={busy || !selectedLines().length}>
            Record shipment
          </button>
        </form>
      )}
      {order.shipments.length > 0 && (
        <section className="mt-7">
          <h2 className="text-xl font-bold">Shipment tracking</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {order.shipments.map((s) => (
              <article className="rounded-xl border p-4" key={s.id}>
                <strong>
                  {s.carrier} · {s.trackingNumber}
                </strong>
                <p className="mt-1 text-sm">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 text-sm">
                  {s.items
                    .map(
                      (i) =>
                        `${order.items.find((l) => l.id === i.orderItemId)?.sku}: ${i.quantity}`,
                    )
                    .join(", ")}
                </p>
                {s.trackingUrl && (
                  <a
                    className="mt-2 inline-block underline"
                    href={s.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Track shipment
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {!admin &&
        order.items.some((i) => i.shippedQuantity > i.returnedQuantity) && (
          <form
            onSubmit={returnRequest}
            className="mt-7 space-y-3 rounded-xl border p-5"
          >
            <h2 className="text-xl font-bold">Request a return or exchange</h2>
            <p className="text-sm">
              Select the return quantities in the items table.
            </p>
            <label className="block">
              Resolution
              <select
                className={input}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value="REFUND">Return for refund</option>
                <option value="EXCHANGE">Exchange</option>
              </select>
            </label>
            <label className="block">
              Reason
              <textarea
                className={input}
                minLength={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label className="block">
              Additional details
              <textarea
                className={input}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <ReturnEvidenceFields
              orderId={id}
              lines={order.items.filter(
                (line) => (quantities[line.id] ?? 0) > 0,
              )}
              evidence={evidence}
              onEvidence={setEvidence}
              descriptions={descriptions}
              onDescriptions={setDescriptions}
              onBusy={setUploadingEvidence}
            />
            <button
              className={button}
              disabled={busy || uploadingEvidence || !selectedLines().length}
            >
              Submit request
            </button>
          </form>
        )}
      {order.returns.length > 0 && (
        <section className="mt-7">
          <h2 className="text-xl font-bold">Returns & exchanges</h2>
          {order.returns.map((r) => (
            <article key={r.id} className="mt-3 rounded-xl border p-5">
              <strong>
                {r.resolution} · {r.status}
              </strong>
              <p className="mt-2">{r.reason}</p>
              {r.description && (
                <p className="mt-2 whitespace-pre-wrap">{r.description}</p>
              )}
              {r.items.map((item) => (
                <p key={item.orderItemId} className="mt-1 text-sm">
                  {
                    order.items.find((line) => line.id === item.orderItemId)
                      ?.sku
                  }{" "}
                  × {item.quantity}
                  {item.description ? ` — ${item.description}` : ""}
                </p>
              ))}
              {!!r.attachments?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.attachments.map((file) => (
                    <button
                      key={file.mediaId}
                      type="button"
                      className={button}
                      onClick={async () => {
                        setError("");
                        try {
                          const signed = await secureApiFetch<{ url: string }>(
                            kind,
                            `${admin ? "/admin/commerce" : ""}/orders/${id}/returns/${r.id}/attachments/${file.mediaId}/access`,
                          );
                          const response = await fetch("/api/v1" + signed.url, {
                            cache: "no-store",
                          });
                          if (!response.ok)
                            throw new Error(
                              "Image download expired or is unavailable",
                            );
                          const url = URL.createObjectURL(
                              await response.blob(),
                            ),
                            link = window.document.createElement("a");
                          link.href = url;
                          link.download = file.fileName;
                          link.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        } catch (error) {
                          setError(
                            error instanceof Error
                              ? error.message
                              : "Image unavailable",
                          );
                        }
                      }}
                    >
                      Download private photo: {file.fileName}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-sm text-neutral-600">{r.staffNote}</p>
              {admin &&
                r.resolution === "EXCHANGE" &&
                r.status === "RECEIVED" && (
                  <form
                    className="mt-4 flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void perform(
                        `/admin/commerce/returns/${r.id}/exchange-shipment`,
                        {
                          idempotencyKey: crypto.randomUUID(),
                          carrier: f.get("carrier"),
                          trackingNumber: f.get("tracking"),
                          items: r.items,
                        },
                      );
                    }}
                  >
                    <label>
                      Replacement carrier
                      <input className={input} name="carrier" required />
                    </label>
                    <label>
                      Replacement tracking number
                      <input className={input} name="tracking" required />
                    </label>
                    <button className={button} disabled={busy}>
                      Ship exchange replacement
                    </button>
                  </form>
                )}
              {admin && (
                <form
                  className="mt-3 flex flex-wrap gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void perform(
                      `/admin/commerce/returns/${r.id}`,
                      { status: f.get("status"), staffNote: f.get("note") },
                      "PATCH",
                    );
                  }}
                >
                  <label className="grow">
                    Decision note
                    <input
                      className={input}
                      name="note"
                      required
                      minLength={3}
                    />
                  </label>
                  <label>
                    Next status
                    <select className={input} name="status">
                      {(r.status === "REQUESTED"
                        ? ["APPROVED", "REJECTED"]
                        : r.status === "APPROVED"
                          ? ["RECEIVED"]
                          : r.status === "RECEIVED"
                            ? ["COMPLETED"]
                            : []
                      ).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={`${button} self-end`}
                    disabled={
                      busy || ["COMPLETED", "REJECTED"].includes(r.status)
                    }
                  >
                    Update return
                  </button>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
      {admin &&
        ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) && (
          <form
            onSubmit={refund}
            className="mt-7 space-y-3 rounded-xl border p-5"
          >
            <h2 className="text-xl font-bold">Issue a refund</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Amount ({order.currency})
                <input
                  className={input}
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={order.totalCents / 100}
                  required
                />
              </label>
              <label>
                Related return (optional)
                <select className={input} name="returnId">
                  <option value="">Order adjustment</option>
                  {order.returns
                    .filter((r) => ["RECEIVED", "COMPLETED"].includes(r.status))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.resolution} · {r.reason}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="block">
              Refund reason
              <textarea
                className={input}
                name="reason"
                required
                minLength={3}
              />
            </label>
            <button className={button} disabled={busy}>
              Submit refund
            </button>
          </form>
        )}
      {order.refunds.length > 0 && (
        <section className="mt-7">
          <h2 className="text-xl font-bold">Refund history</h2>
          {order.refunds.map((r) => (
            <article key={r.id} className="mt-3 rounded-xl border p-4">
              <strong>
                {money(r.amountCents)} · {r.status}
              </strong>
              <p>{r.reason}</p>
              <p className="text-sm">{r.providerReference}</p>
              {admin && r.status === "PENDING" && (
                <form
                  className="mt-3 flex flex-wrap gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void perform(
                      `/admin/commerce/refunds/${r.id}/result`,
                      {
                        status: f.get("status"),
                        providerReference: f.get("reference"),
                      },
                      "PATCH",
                    );
                  }}
                >
                  <label>
                    Provider reference
                    <input
                      className={input}
                      name="reference"
                      minLength={3}
                      required
                    />
                  </label>
                  <label>
                    Provider result
                    <select className={input} name="status">
                      <option>SUCCEEDED</option>
                      <option>FAILED</option>
                    </select>
                  </label>
                  <button className={`${button} self-end`} disabled={busy}>
                    Record external result
                  </button>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
      {!!order.history?.length && (
        <section className="mt-8 rounded-xl border p-5">
          <h2 className="text-xl font-semibold">Order history</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {order.history.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`}>
                <time>{new Date(entry.createdAt).toLocaleString()}</time> ·{" "}
                {entry.action.replace("order.", "").replaceAll(".", " ")}
                {entry.reason && (
                  <p className="mt-1 text-neutral-600">{entry.reason}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </Container>
  );
}

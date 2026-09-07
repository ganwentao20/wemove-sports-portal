"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { secureApiFetch } from "../lib/secure-api";
type Item = {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  shippedQuantity: number;
  unitPriceCents: number;
};
type Return = {
  id: string;
  status: string;
  reason: string;
  decisionReason?: string;
  carrier?: string;
  trackingNumber?: string;
  receivedAt?: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    receivedQuantity: number;
    restockQuantity: number;
    orderItem: { sku: string; productName: string };
  }>;
};
type Refund = {
  id: string;
  status: string;
  reason: string;
  amountCents: number;
  returnId: string | null;
  cancelOrder: boolean;
  decisionReason?: string;
  providerReference?: string;
  attempts: number;
  lastError?: string;
  availableAt: string;
  completedAt?: string;
};
type Data = {
  canWrite: boolean;
  currency: string;
  paidCents: number;
  heldCents: number;
  refundedCents: number;
  order: {
    id: string;
    orderNo: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    currency: string;
    market: string;
    totalCents: number;
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    items: Item[];
  };
  returns: Return[];
  refunds: Refund[];
};
const input = "mt-1 w-full rounded border border-neutral-300 p-2";
const button =
  "rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40";
export function PurchaseOrderAfterSales({
  orderId,
  admin = false,
}: {
  orderId: string;
  admin?: boolean;
}) {
  const base = admin ? "/admin/b2b" : "/dealer",
    kind = admin ? "staff" : "dealer";
  const [data, setData] = useState<Data | null>(null),
    [mfa, setMfa] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [returnKey, setReturnKey] = useState(""),
    [refundKey, setRefundKey] = useState("");
  const receiptKeys = useRef<Record<string, string>>({});
  const load = useCallback(
    async () =>
      setData(
        await secureApiFetch<Data>(
          kind,
          base + "/purchase-orders/" + orderId + "/after-sales",
        ),
      ),
    [base, kind, orderId],
  );
  useEffect(() => {
    setReturnKey(crypto.randomUUID());
    setRefundKey(crypto.randomUUID());
    void load().catch((cause) => setError(cause.message));
  }, [load]);
  async function act(path: string, body: unknown) {
    if (admin && !/^\d{6}$/.test(mfa)) {
      setError("Enter your current six-digit MFA code.");
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await secureApiFetch(kind, base + path, {
        method: "POST",
        headers: admin ? { "x-mfa-code": mfa } : undefined,
        body: JSON.stringify(body),
      });
      await load();
      setMfa("");
      setNotice("Saved. Current status and history are shown below.");
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const money = (n: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: data?.currency ?? "USD",
    }).format(n / 100);
  const remaining = data ? Math.max(0, data.paidCents - data.heldCents) : 0;
  const availableReturn = (id: string, shipped: number) =>
    Math.max(
      0,
      shipped -
        (data?.returns
          .filter((r) => !["REJECTED", "CANCELLED"].includes(r.status))
          .flatMap((r) => r.items)
          .filter((i) => i.orderItemId === id)
          .reduce((sum, i) => sum + i.quantity, 0) ?? 0),
    );
  const returnCap = (request: Return) => {
    if (!data?.order.subtotalCents) return 0;
    const gross = request.items.reduce(
      (sum, i) =>
        sum +
        (data.order.items.find((item) => item.id === i.orderItemId)
          ?.unitPriceCents ?? 0) *
          i.receivedQuantity,
      0,
    );
    const net = data.order.totalCents - data.order.shippingCents;
    return Math.max(
      0,
      Number((BigInt(gross) * BigInt(net)) / BigInt(data.order.subtotalCents)) -
        data.refunds
          .filter(
            (r) =>
              r.returnId === request.id &&
              !["REJECTED", "CANCELLED"].includes(r.status),
          )
          .reduce((sum, r) => sum + r.amountCents, 0),
    );
  };
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl space-y-6 px-4 py-10"
    >
      <Link
        href={admin ? "/admin/b2b" : "/dealer/procurement"}
        className="underline"
      >
        Back to purchase orders
      </Link>
      <h1 className="text-3xl font-bold">
        Returns & refunds{data ? " · " + data.order.orderNo : ""}
      </h1>
      {admin && (
        <label className="block max-w-xs">
          Current MFA code
          <input
            className={input}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfa}
            onChange={(e) =>
              setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </label>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded bg-emerald-50 p-3">
          {notice}
        </p>
      )}
      {!data && !error && <p role="status">Loading after-sales records…</p>}
      {data && (
        <>
          <section className="rounded-xl bg-sky-50 p-5">
            <p>
              {data.order.status} · {data.order.paymentStatus} ·{" "}
              {data.order.market}
            </p>
            <p className="mt-2">
              Paid {money(data.paidCents)} · Refunded{" "}
              {money(data.refundedCents)} · Available to request{" "}
              {money(remaining)}
            </p>
            <p className="mt-2 text-sm">
              Pending refunds reserve the refund balance. Received returns
              restore only the units confirmed as sellable; damaged goods remain
              outside available inventory.
            </p>
          </section>
          {data.canWrite && (
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                className="space-y-3 rounded-xl border p-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const lines = data.order.items.flatMap((item) => {
                    const quantity = Number(f.get(item.id));
                    return quantity > 0
                      ? [{ orderItemId: item.id, quantity }]
                      : [];
                  });
                  if (
                    await act("/purchase-orders/" + orderId + "/returns", {
                      idempotencyKey: returnKey,
                      reason: f.get("reason"),
                      lines,
                    })
                  )
                    setReturnKey(crypto.randomUUID());
                }}
              >
                <h2 className="text-xl font-semibold">Request a return</h2>
                <p className="text-sm">
                  Choose shipped items. Wait for approval before sending goods
                  back.
                </p>
                {data.order.items.map((item) => (
                  <label className="block text-sm" key={item.id}>
                    {item.sku} · {item.productName} (
                    {availableReturn(item.id, item.shippedQuantity)} returnable)
                    <input
                      className={input}
                      name={item.id}
                      type="number"
                      min={0}
                      max={availableReturn(item.id, item.shippedQuantity)}
                      defaultValue={0}
                      disabled={!availableReturn(item.id, item.shippedQuantity)}
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  Reason
                  <textarea
                    className={input}
                    name="reason"
                    minLength={3}
                    maxLength={1000}
                    required
                  />
                </label>
                <button
                  className={button}
                  disabled={
                    busy ||
                    !data.order.items.some(
                      (item) =>
                        availableReturn(item.id, item.shippedQuantity) > 0,
                    )
                  }
                >
                  Submit return request
                </button>
              </form>
              <form
                className="space-y-3 rounded-xl border p-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await act("/purchase-orders/" + orderId + "/refunds", {
                      idempotencyKey: refundKey,
                      amountCents: Math.round(Number(f.get("amount")) * 100),
                      reason: f.get("reason"),
                      returnId: f.get("returnId") || undefined,
                      cancelOrder: f.get("cancelOrder") === "on",
                    })
                  )
                    setRefundKey(crypto.randomUUID());
                }}
              >
                <h2 className="text-xl font-semibold">Request a refund</h2>
                <p className="text-sm">
                  Shipped goods require a received return. Approved bank/PO
                  refunds need a recorded transfer; card refunds wait for the
                  payment provider’s confirmation.
                </p>
                <label className="block text-sm">
                  Amount ({data.currency})
                  <input
                    className={input}
                    name="amount"
                    type="number"
                    min={0.01}
                    max={remaining / 100}
                    step={0.01}
                    required
                  />
                </label>
                <label className="block text-sm">
                  Received return (when applicable)
                  <select className={input} name="returnId">
                    <option value="">No return linked</option>
                    {data.returns
                      .filter((r) => r.status === "RECEIVED")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id.slice(-8)} · up to {money(returnCap(r))}
                        </option>
                      ))}
                  </select>
                </label>
                {!data.order.items.some((i) => i.shippedQuantity > 0) && (
                  <label className="block text-sm">
                    <input type="checkbox" name="cancelOrder" /> Cancel the
                    unshipped order after the full remaining balance is refunded
                  </label>
                )}
                <label className="block text-sm">
                  Reason
                  <textarea
                    className={input}
                    name="reason"
                    minLength={3}
                    maxLength={1000}
                    required
                  />
                </label>
                <button className={button} disabled={busy || remaining <= 0}>
                  Submit refund request
                </button>
              </form>
            </div>
          )}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Return history</h2>
            {!data.returns.length && (
              <p className="text-neutral-500">No return requests.</p>
            )}
            {data.returns.map((request) => (
              <article
                key={request.id}
                className="space-y-3 rounded-xl border p-5"
              >
                <p className="font-semibold">
                  {request.id} · {request.status}
                </p>
                <p>{request.reason}</p>
                {request.decisionReason && (
                  <p className="text-sm">Review: {request.decisionReason}</p>
                )}
                <ul className="text-sm">
                  {request.items.map((item) => (
                    <li key={item.orderItemId}>
                      {item.orderItem.sku}: requested {item.quantity}, received{" "}
                      {item.receivedQuantity}, restocked {item.restockQuantity}
                    </li>
                  ))}
                </ul>
                {request.trackingNumber && (
                  <p>
                    {request.carrier} · {request.trackingNumber}
                  </p>
                )}
                {admin && request.status === "REQUESTED" && (
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const decision = (
                        e.nativeEvent as SubmitEvent
                      ).submitter?.getAttribute("value");
                      await act("/returns/" + request.id + "/decision", {
                        decision,
                        reason: f.get("reason"),
                      });
                    }}
                  >
                    <label className="grow text-sm">
                      Review reason
                      <input
                        className={input}
                        name="reason"
                        minLength={3}
                        required
                      />
                    </label>
                    <button className={button} value="APPROVE" disabled={busy}>
                      Approve return
                    </button>
                    <button className={button} value="REJECT" disabled={busy}>
                      Reject return
                    </button>
                  </form>
                )}
                {data.canWrite &&
                  ["APPROVED", "IN_TRANSIT"].includes(request.status) && (
                    <form
                      className="flex flex-wrap items-end gap-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        await act("/returns/" + request.id + "/tracking", {
                          carrier: f.get("carrier"),
                          trackingNumber: f.get("trackingNumber"),
                        });
                      }}
                    >
                      <label className="text-sm">
                        Return carrier
                        <input
                          className={input}
                          name="carrier"
                          defaultValue={request.carrier}
                          required
                        />
                      </label>
                      <label className="grow text-sm">
                        Tracking number
                        <input
                          className={input}
                          name="trackingNumber"
                          defaultValue={request.trackingNumber}
                          required
                        />
                      </label>
                      <button className={button} disabled={busy}>
                        Save return shipment
                      </button>
                    </form>
                  )}
                {!admin &&
                  data.canWrite &&
                  ["REQUESTED", "APPROVED"].includes(request.status) && (
                    <form
                      className="flex gap-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await act("/returns/" + request.id + "/cancel", {
                          reason: new FormData(e.currentTarget).get("reason"),
                        });
                      }}
                    >
                      <input
                        className={input}
                        name="reason"
                        aria-label="Withdrawal reason"
                        placeholder="Withdrawal reason"
                        minLength={3}
                        required
                      />
                      <button className={button} disabled={busy}>
                        Withdraw return
                      </button>
                    </form>
                  )}
                {admin &&
                  ["APPROVED", "IN_TRANSIT"].includes(request.status) && (
                    <form
                      className="space-y-3 rounded bg-neutral-50 p-4"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        receiptKeys.current[request.id] ??= crypto.randomUUID();
                        await act("/returns/" + request.id + "/receive", {
                          receiveKey: receiptKeys.current[request.id],
                          note: f.get("note"),
                          lines: request.items.map((item) => ({
                            orderItemId: item.orderItemId,
                            quantity: item.quantity,
                            restockQuantity: Number(f.get(item.orderItemId)),
                          })),
                        });
                      }}
                    >
                      <h3 className="font-semibold">
                        Confirm physical receipt
                      </h3>
                      <p className="text-sm">
                        Confirm all units in this approved return have arrived.
                        Record how many are sellable; the remainder will be
                        recorded as received without restocking.
                      </p>
                      {request.items.map((item) => (
                        <label key={item.orderItemId} className="block text-sm">
                          {item.orderItem.sku} · sellable units out of{" "}
                          {item.quantity}
                          <input
                            className={input}
                            name={item.orderItemId}
                            type="number"
                            min={0}
                            max={item.quantity}
                            defaultValue={item.quantity}
                            required
                          />
                        </label>
                      ))}
                      <label className="block text-sm">
                        Inspection note
                        <input
                          className={input}
                          name="note"
                          minLength={3}
                          required
                        />
                      </label>
                      <button className={button} disabled={busy}>
                        Record receipt & restock sellable units
                      </button>
                    </form>
                  )}
              </article>
            ))}
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Refund history</h2>
            {!data.refunds.length && (
              <p className="text-neutral-500">No refund requests.</p>
            )}
            {data.refunds.map((refund) => (
              <article
                key={refund.id}
                className="space-y-3 rounded-xl border p-5"
              >
                <p className="font-semibold">
                  {money(refund.amountCents)} · {refund.status}
                </p>
                <p className="break-all text-xs">
                  {refund.id}
                  {refund.returnId ? " · Return " + refund.returnId : ""}
                </p>
                <p>{refund.reason}</p>
                {refund.cancelOrder && (
                  <p className="text-sm">
                    The order will be cancelled only after the refund is
                    confirmed.
                  </p>
                )}
                {refund.decisionReason && (
                  <p className="text-sm">Review: {refund.decisionReason}</p>
                )}
                {refund.providerReference && (
                  <p className="text-sm">
                    Provider/transfer reference: {refund.providerReference}
                  </p>
                )}
                {refund.lastError && (
                  <p role="status" className="text-sm text-amber-800">
                    Refund confirmation pending · attempts {refund.attempts} ·
                    retry after {new Date(refund.availableAt).toLocaleString()}
                  </p>
                )}
                {!admin && data.canWrite && refund.status === "REQUESTED" && (
                  <form
                    className="flex gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await act("/refunds/" + refund.id + "/cancel", {
                        reason: new FormData(e.currentTarget).get("reason"),
                      });
                    }}
                  >
                    <input
                      className={input}
                      name="reason"
                      aria-label="Refund withdrawal reason"
                      minLength={3}
                      placeholder="Withdrawal reason"
                      required
                    />
                    <button className={button} disabled={busy}>
                      Withdraw refund request
                    </button>
                  </form>
                )}
                {admin && refund.status === "REQUESTED" && (
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const decision = (
                        e.nativeEvent as SubmitEvent
                      ).submitter?.getAttribute("value");
                      await act("/refunds/" + refund.id + "/decision", {
                        decision,
                        reason: f.get("reason"),
                      });
                    }}
                  >
                    <label className="grow text-sm">
                      Review reason
                      <input
                        className={input}
                        name="reason"
                        minLength={3}
                        required
                      />
                    </label>
                    <button className={button} value="APPROVE" disabled={busy}>
                      Approve refund
                    </button>
                    <button className={button} value="REJECT" disabled={busy}>
                      Reject refund
                    </button>
                  </form>
                )}
                {admin && refund.status === "AWAITING_OFFLINE" && (
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await act("/refunds/" + refund.id + "/offline-confirm", {
                        amountCents: refund.amountCents,
                        providerReference: new FormData(e.currentTarget).get(
                          "reference",
                        ),
                      });
                    }}
                  >
                    <label className="grow text-sm">
                      Completed bank transfer reference
                      <input
                        className={input}
                        name="reference"
                        minLength={3}
                        maxLength={160}
                        required
                      />
                    </label>
                    <button className={button} disabled={busy}>
                      Confirm {money(refund.amountCents)} transferred
                    </button>
                  </form>
                )}
                {admin && refund.status === "PENDING" && (
                  <button
                    className={button}
                    disabled={
                      busy ||
                      (!refund.lastError &&
                        new Date(refund.availableAt) > new Date())
                    }
                    onClick={() =>
                      void act("/refunds/" + refund.id + "/retry", {})
                    }
                  >
                    Retry payment provider
                  </button>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

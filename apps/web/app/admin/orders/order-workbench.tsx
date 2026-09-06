"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type OrderStatus = "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";
type Order = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  user: { id: string; email: string; name: string };
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    variantName: string | null;
    quantity: number;
    lineCents: number;
  }>;
};
type OrderPage = { items: Order[]; total: number };

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function OrderWorkbench() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = status ? `?status=${status}` : "";
      const result = await secureApiFetch<OrderPage>(
        "staff",
        `/admin/orders${query}`,
      );
      setOrders(result.items);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("staff").catch(() => undefined);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load orders.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(order: Order, next: OrderStatus) {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the current 6-digit MFA code before updating an order.");
      return;
    }
    if (
      !window.confirm(`Move ${order.orderNo} from ${order.status} to ${next}?`)
    )
      return;
    setBusy(order.id);
    setError("");
    try {
      await secureApiFetch("staff", `/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "x-mfa-code": mfaCode },
        body: JSON.stringify({ status: next }),
      });
      setMfaCode("");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to update order.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await sessionLogout("staff");
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
          <h1 className="mt-1 text-3xl font-bold">Order fulfillment</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Confirm, fulfill or cancel orders with transactional inventory
            handling.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            MFA code
            <input
              value={mfaCode}
              onChange={(event) =>
                setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="ml-2 w-28 rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Status{" "}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="ml-2 rounded-lg border bg-white px-3 py-2"
            >
              <option value="">All</option>
              {(
                ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const
              ).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void signOut()}
            className="pb-2 text-sm text-neutral-500 underline"
          >
            Sign out
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-8 text-neutral-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-neutral-500">
          No orders found.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border border-neutral-200 p-5"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{order.orderNo}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {order.user.name} · {order.user.email}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded bg-neutral-100 px-3 py-1 text-xs font-semibold">
                    {order.status}
                  </span>
                  <p className="mt-2 text-lg font-bold">
                    {money(order.totalCents)}
                  </p>
                </div>
              </div>
              <ul className="mt-4 divide-y border-y text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-4 py-2">
                    <span>
                      {item.productName} · {item.variantName || item.sku} ×{" "}
                      {item.quantity}
                    </span>
                    <span>{money(item.lineCents)}</span>
                  </li>
                ))}
              </ul>
              {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {order.status === "PENDING" && (
                    <button
                      disabled={busy === order.id}
                      onClick={() => void transition(order, "CONFIRMED")}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  )}
                  {order.status === "CONFIRMED" && (
                    <button
                      disabled={busy === order.id}
                      onClick={() => void transition(order, "FULFILLED")}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Fulfill
                    </button>
                  )}
                  <button
                    disabled={busy === order.id}
                    onClick={() => void transition(order, "CANCELLED")}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

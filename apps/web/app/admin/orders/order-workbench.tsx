"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

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
  currency: string;
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

const money = (cents: number, currency = "USD") =>
  `${currency} ${(cents / 100).toFixed(2)}`;

export function OrderWorkbench() {
  const t = useUiText();
  const uiLocale = useUiLocale();

  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [changeReason, setChangeReason] = useState("");
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
    if (changeReason.trim().length < 3) {
      setError("Enter the reason for this order status change.");
      return;
    }
    if (
      !window.confirm(
        t("Move {value1} from {value2} to {value3}?", {
          value1: order.orderNo,
          value2: t(order.status),
          value3: next,
        }),
      )
    )
      return;
    setBusy(order.id);
    setError("");
    try {
      await secureApiFetch("staff", `/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "x-mfa-code": mfaCode },
        body: JSON.stringify({ status: next, reason: changeReason.trim() }),
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
  async function exportOrders() {
    setError("");
    try {
      const data = await secureApiFetch<{ csv: string; fileName: string }>(
        "staff",
        `/admin/orders/export${status ? `?status=${status}` : ""}`,
      );
      const url = URL.createObjectURL(
        new Blob([data.csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-7xl px-4 py-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">
            {t("WEMOVE ADMIN")}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{t("Order fulfillment")}</h1>
          <p className="mt-2 text-sm text-neutral-500">
            {t(
              "Track payment, partial shipments, returns and inventory reservations.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            {t("MFA code")}
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
            {t("Change reason")}
            <input
              className="ml-2 rounded-lg border px-3 py-2"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              maxLength={500}
            />
          </label>
          <label className="text-sm">
            {t("Status")}{" "}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="ml-2 rounded-lg border bg-white px-3 py-2"
            >
              <option value="">{t("All")}</option>
              {(
                ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {t(String(value))}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void exportOrders()}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            {t("Export filtered orders")}
          </button>
          <button
            onClick={() => void signOut()}
            className="pb-2 text-sm text-neutral-500 underline"
          >
            {t("Sign out")}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error ? uiError(uiLocale, error) : ""}
        </p>
      )}
      {loading ? (
        <p className="mt-8 text-neutral-500">{t("Loading orders…")}</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-neutral-500">
          {t("No orders found.")}
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
                  <h2 className="font-semibold">
                    <a className="underline" href={`/admin/orders/${order.id}`}>
                      {order.orderNo}
                    </a>
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {order.user.name} · {order.user.email}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(order.createdAt).toLocaleString(
                      uiLocale === "zh" ? "zh-CN" : "en-US",
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded bg-neutral-100 px-3 py-1 text-xs font-semibold">
                    {t(String(order.status))}
                  </span>
                  <p className="mt-2 text-lg font-bold">
                    {money(order.totalCents, order.currency)}
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
                    <span>{money(item.lineCents, order.currency)}</span>
                  </li>
                ))}
              </ul>
              {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <a
                    className="rounded-full border px-4 py-2 font-semibold"
                    href={`/admin/orders/${order.id}`}
                  >
                    {t("Payments, shipments & returns")}
                  </a>
                  <button
                    disabled={busy === order.id}
                    onClick={() => void transition(order, "CANCELLED")}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {t("Cancel")}
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

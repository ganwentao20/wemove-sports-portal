"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type Account = {
  id: string;
  kind: "customer";
  email: string;
  name: string;
  companyId: string | null;
  companyRole: string | null;
};
type CartItem = {
  id: string;
  variantId: string;
  sku: string | null;
  name: string | null;
  quantity: number;
  unitPriceCents: number;
  lineCents: number;
};
type Cart = {
  id: string;
  itemCount: number;
  totalCents: number;
  items: CartItem[];
};
type OrderStatus = "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";
type Order = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    variantName: string | null;
    quantity: number;
    lineCents: number;
  }>;
};
type OrderPage = {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function CustomerAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyVariant, setBusyVariant] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profile, currentCart, currentOrders] = await Promise.all([
        secureApiFetch<Account>("customer", "/auth/me"),
        secureApiFetch<Cart>("customer", "/cart"),
        secureApiFetch<OrderPage>("customer", "/orders?page=1&pageSize=20"),
      ]);
      setAccount(profile);
      setCart(currentCart);
      setOrders(currentOrders.items);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("customer").catch(() => undefined);
        router.replace("/customer/login?next=/customer/account");
        return;
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load your account.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateQuantity(variantId: string, quantity: number) {
    setBusyVariant(variantId);
    setError("");
    try {
      const nextCart = await secureApiFetch<Cart>(
        "customer",
        `/cart/items/${variantId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        },
      );
      setCart(nextCart);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to update cart.",
      );
    } finally {
      setBusyVariant(null);
    }
  }

  async function removeItem(variantId: string) {
    setBusyVariant(variantId);
    setError("");
    try {
      const nextCart = await secureApiFetch<Cart>(
        "customer",
        `/cart/items/${variantId}`,
        {
          method: "DELETE",
        },
      );
      setCart(nextCart);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to remove item.",
      );
    } finally {
      setBusyVariant(null);
    }
  }

  async function clearCart() {
    setError("");
    try {
      await secureApiFetch("customer", "/cart", { method: "DELETE" });
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to clear cart.",
      );
    }
  }

  async function checkout() {
    setPlacingOrder(true);
    setError("");
    setNotice("");
    try {
      const order = await secureApiFetch<Order>(
        "customer",
        "/orders/checkout",
        {
          method: "POST",
        },
      );
      setNotice(
        `Order ${order.orderNo} was created and inventory is reserved.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to place order.",
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  async function cancelOrder(id: string) {
    setError("");
    setNotice("");
    try {
      await secureApiFetch<Order>("customer", `/orders/${id}/cancel`, {
        method: "PATCH",
      });
      setNotice("Order cancelled and reserved inventory returned.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to cancel order.",
      );
    }
  }

  async function signOut() {
    await sessionLogout("customer");
    router.replace("/customer/login");
    router.refresh();
  }

  if (loading) {
    return (
      <p className="mx-auto max-w-6xl px-4 py-10 text-neutral-500">
        Loading your account…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Account</h1>
          {account && (
            <p className="mt-2 text-sm text-neutral-500">
              {account.name} · {account.email}
            </p>
          )}
        </div>
        <button
          onClick={() => void signOut()}
          className="text-sm text-neutral-500 underline"
        >
          Sign out
        </button>
      </div>
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

      <section className="mt-8 rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Shopping cart</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {cart?.itemCount ?? 0} product lines
            </p>
          </div>
          {cart && cart.items.length > 0 && (
            <button
              onClick={() => void clearCart()}
              className="text-sm text-red-600 underline"
            >
              Clear cart
            </button>
          )}
        </div>
        {!cart || cart.items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-neutral-500">
            Your cart is empty.{" "}
            <a
              href="/products"
              className="font-semibold text-[var(--wm-primary)]"
            >
              Browse products
            </a>
          </div>
        ) : (
          <div className="mt-6 divide-y">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-medium">
                    {item.name || item.sku || "Product variant"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {item.sku} · {money(item.unitPriceCents)} each
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    key={`${item.variantId}-${item.quantity}`}
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={item.quantity}
                    disabled={busyVariant === item.variantId}
                    onBlur={(event) => {
                      const quantity = Number(event.target.value);
                      if (
                        Number.isInteger(quantity) &&
                        quantity >= 0 &&
                        quantity <= 99 &&
                        quantity !== item.quantity
                      )
                        void updateQuantity(item.variantId, quantity);
                    }}
                    className="w-20 rounded-lg border px-2 py-1"
                    aria-label={`Quantity for ${item.name || item.sku}`}
                  />
                  <span className="w-20 text-right font-semibold">
                    {money(item.lineCents)}
                  </span>
                  <button
                    disabled={busyVariant === item.variantId}
                    onClick={() => void removeItem(item.variantId)}
                    className="text-sm text-red-600 underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-end gap-4 pt-5">
              <p className="text-xl font-bold">
                Total {money(cart.totalCents)}
              </p>
              <button
                disabled={placingOrder}
                onClick={() => void checkout()}
                className="rounded-full bg-[var(--wm-primary)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {placingOrder ? "Placing order…" : "Checkout"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-xl font-semibold">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No orders yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {orders.map((order) => (
              <article key={order.id} className="rounded-xl bg-neutral-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{order.orderNo}</h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Date(order.createdAt).toLocaleString()} ·{" "}
                      {order.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{money(order.totalCents)}</p>
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => void cancelOrder(order.id)}
                        className="mt-1 text-xs text-red-600 underline"
                      >
                        Cancel order
                      </button>
                    )}
                  </div>
                </div>
                <ul className="mt-3 divide-y text-sm">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between gap-4 py-2"
                    >
                      <span>
                        {item.productName} · {item.variantName || item.sku} ×{" "}
                        {item.quantity}
                      </span>
                      <span>{money(item.lineCents)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {["Addresses — next", "Wishlist — next"].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-400"
          >
            {item}
          </div>
        ))}
      </section>
    </div>
  );
}

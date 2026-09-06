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

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function CustomerAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyVariant, setBusyVariant] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profile, currentCart] = await Promise.all([
        secureApiFetch<Account>("customer", "/auth/me"),
        secureApiFetch<Cart>("customer", "/cart"),
      ]);
      setAccount(profile);
      setCart(currentCart);
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

  async function signOut() {
    await sessionLogout("customer");
    router.replace("/customer/login");
    router.refresh();
  }

  if (loading)
    return (
      <p className="mx-auto max-w-6xl px-4 py-10 text-neutral-500">
        Loading your account…
      </p>
    );

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
                      ) {
                        void updateQuantity(item.variantId, quantity);
                      }
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
            <p className="pt-5 text-right text-xl font-bold">
              Total {money(cart.totalCents)}
            </p>
          </div>
        )}
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          "Addresses — next",
          "Orders — awaiting checkout",
          "Wishlist — next",
        ].map((item) => (
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

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
  shippedQuantity?: number;
};
type Quote = {
  currency: string;
  version: number;
  items: Item[];
  totalCents: number;
  taxCents: number;
  shippingCents: number;
  validUntil: string;
  paymentTerms: string;
  deliveryTerms?: string;
  discountCents: number;
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
  billingAddress: Record<string, string>;
  inventoryReserved: boolean;
  cancellationReason?: string;
  adjustments?: Array<{ at: string; reason: string }>;
  customerPoNumber?: string;
  paymentMethod: string;
  paymentTerms: string;
  paymentStatus: string;
  currency: string;
  shipments: Array<{
    id: string;
    carrier: string;
    trackingNumber: string;
    lines: Array<{ sku: string; quantity: number }>;
  }>;
};
type Rfq = {
  id: string;
  companyId: string;
  title: string;
  note?: string;
  targetDeliveryAt?: string;
  rejectionReason?: string;
  attachmentIds?: string[];
  status: string;
  revision: number;
  items: Item[];
  quotes: Quote[];
  company?: { companyName: string; purchaseSettings?: { currency?: string } };
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
const money = (cents: number, currency = "USD") =>
  `${currency} ${(cents / 100).toFixed(2)}`;
const nextStates: Record<string, string[]> = {
  PENDING_REVIEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: [],
  SHIPPED: ["COMPLETED"],
};

function Lines({
  items,
  currency = "USD",
}: {
  items: Item[];
  currency?: string;
}) {
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
                {money(item.unitPriceCents, currency)}
              </td>
              <td className="p-3 whitespace-nowrap">
                {money(item.lineCents, currency)}
              </td>
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
      discountCents: Math.round(Number(data.get("discount")) * 100),
      paymentTerms: String(data.get("paymentTerms")),
      deliveryTerms: String(data.get("deliveryTerms")),
    });
  }
  return (
    <form onSubmit={submit} className="mt-5 rounded-lg bg-neutral-50 p-4">
      <h3 className="font-semibold">
        {rfq.revision ? "Issue a revised quote" : "Prepare quote"}
      </h3>
      <p className="mt-1 text-sm text-neutral-600">
        Prices are in{" "}
        {rfq.company?.purchaseSettings?.currency ??
          rfq.quotes[0]?.currency ??
          "USD"}
        . Existing quote versions remain available for reference.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          Discount (
          {rfq.company?.purchaseSettings?.currency ??
            rfq.quotes[0]?.currency ??
            "USD"}
          )
          <input
            name="discount"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className={input}
          />
        </label>
        <label>
          Payment terms
          <input
            name="paymentTerms"
            defaultValue="PREPAID"
            required
            maxLength={160}
            className={input}
          />
        </label>
        <label>
          Delivery terms
          <input name="deliveryTerms" maxLength={500} className={input} />
        </label>
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
          Tax (
          {rfq.company?.purchaseSettings?.currency ??
            rfq.quotes[0]?.currency ??
            "USD"}
          )
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
          Shipping (
          {rfq.company?.purchaseSettings?.currency ??
            rfq.quotes[0]?.currency ??
            "USD"}
          )
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
  admin = false,
}: {
  rfq: Rfq;
  act: Action;
  busy: boolean;
  admin?: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [addresses, setAddresses] = useState<
    Array<{ id: string; label: string; address: Record<string, string> }>
  >([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [billingId, setBillingId] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([
    "BANK_TRANSFER",
    "PO",
    "ACCOUNT",
  ]);
  useEffect(() => {
    void secureApiFetch<{
      company: {
        purchaseSettings: { paymentMethods?: string[] };
        profile: {
          defaultShippingAddressId?: string;
          defaultBillingAddressId?: string;
        };
      };
      addresses: Array<{
        id: string;
        label: string;
        address: Record<string, string>;
      }>;
    }>(
      admin ? "staff" : "dealer",
      admin ? "/admin/b2b/companies/" + rfq.companyId : "/dealer/company",
    )
      .then((r) => {
        setAddresses(r.addresses);
        setSelectedAddress(r.company.profile.defaultShippingAddressId ?? "");
        setBillingId(r.company.profile.defaultBillingAddressId ?? "");
        if (r.company.purchaseSettings.paymentMethods)
          setPaymentMethods(r.company.purchaseSettings.paymentMethods);
      })
      .catch(() => undefined);
  }, [admin, rfq.companyId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const shippingAddress = Object.fromEntries(
      [
        "recipient",
        "phone",
        "country",
        "city",
        "addressLine",
        "postalCode",
      ].map((k) => [k, String(form.get(k) ?? "")]),
    );
    shippingAddress.country = String(shippingAddress.country).toUpperCase();
    await act(`/rfqs/${rfq.id}/${admin ? "purchase-order" : "accept"}`, {
      ...(admin ? { staffReason: String(form.get("staffReason")) } : {}),
      version: rfq.revision,
      shippingAddress,
      billingAddress:
        addresses.find((a) => a.id === billingId)?.address ?? shippingAddress,
      customerPoNumber: form.get("customerPoNumber") || undefined,
      paymentMethod: form.get("paymentMethod"),
    });
  }
  if (!opened)
    return (
      <button
        onClick={() => setOpened(true)}
        disabled={busy}
        className={button}
      >
        {admin
          ? "Create purchase order for company"
          : "Accept quote & create purchase order"}
      </button>
    );
  return (
    <form onSubmit={submit} className="mt-3 w-full rounded-lg bg-blue-50 p-4">
      <h3 className="font-semibold">Delivery details</h3>
      {admin && (
        <label className="block">
          Staff authorization / reason
          <textarea
            name="staffReason"
            minLength={5}
            maxLength={1000}
            required
            className={input}
          />
          <span className="text-sm">
            This records a staff-created order with your identity and reason.
            Company acceptance and account consent records are not changed.
          </span>
        </label>
      )}
      <label>
        Saved shipping address
        <select
          className={input}
          value={selectedAddress}
          onChange={(e) => setSelectedAddress(e.target.value)}
        >
          <option value="">Enter address below</option>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Billing address
        <select
          className={input}
          value={billingId}
          onChange={(e) => setBillingId(e.target.value)}
        >
          <option value="">Same as shipping</option>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Customer PO number
        <input name="customerPoNumber" maxLength={80} className={input} />
      </label>
      <label>
        Payment method
        <select name="paymentMethod" className={input}>
          {paymentMethods.map((m) => (
            <option key={m} value={m}>
              {(
                {
                  BANK_TRANSFER: "Bank transfer",
                  PO: "Purchase order",
                  ACCOUNT: "Company account terms",
                  CARD: "Credit card",
                } as Record<string, string>
              )[m] ?? m}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1 text-sm">
        Accepting version {rfq.revision} creates one purchase order and reserves
        stock. Total: {money(rfq.quotes[0].totalCents, rfq.quotes[0].currency)}.
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
              key={`${String(name)}-${selectedAddress}`}
              defaultValue={
                addresses.find((a) => a.id === selectedAddress)?.address[
                  String(name)
                ] ?? ""
              }
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
          {admin ? "Create company purchase order" : "Confirm purchase order"}
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

function PayCard({
  order,
  refresh,
  onError,
}: {
  order: Order;
  refresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [demoId, setDemoId] = useState("");
  async function begin() {
    setBusy(true);
    try {
      const p = await secureApiFetch<{
        id: string;
        mode: string;
        checkoutUrl?: string;
      }>("dealer", `/dealer/purchase-orders/${order.id}/payment-session`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      if (p.mode === "DEMO") setDemoId(p.id);
      else if (p.checkoutUrl) window.location.assign(p.checkoutUrl);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  async function finish(status: string) {
    setBusy(true);
    try {
      await secureApiFetch("dealer", `/dealer/payments/${demoId}/demo`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setDemoId("");
      await refresh();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 rounded border p-3">
      {demoId ? (
        <>
          <p>Local test payment. No card is charged.</p>
          <div className="mt-2 flex gap-3">
            {["SUCCEEDED", "FAILED", "CANCELLED"].map((status) => (
              <button
                key={status}
                disabled={busy}
                onClick={() => void finish(status)}
                className="underline"
              >
                Simulate {status.toLowerCase()}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button className={button} disabled={busy} onClick={() => void begin()}>
          Pay by credit card
        </button>
      )}
    </div>
  );
}

function CompanyPolicies({ act, busy }: { act: Action; busy: boolean }) {
  type Options = {
    products: Array<{
      id: string;
      name: string;
      variants: Array<{ id: string; sku: string }>;
    }>;
    categories: Array<{ id: string; name: string }>;
  };
  const [options, setOptions] = useState<Options>({
    products: [],
    categories: [],
  });
  type Company = {
    id: string;
    companyName: string;
    status: string;
    catalogPolicy: Record<string, string[] | string>;
    purchaseSettings: Record<string, unknown>;
  };
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void secureApiFetch<Company[]>("staff", "/admin/b2b/companies")
      .then(setCompanies)
      .catch((e) => setError(e.message));
    void secureApiFetch<Options>("staff", "/admin/b2b/companies/policy/options")
      .then(setOptions)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="mt-8 rounded border p-5">
      <h2 className="text-xl font-semibold">
        Company product authorization & purchase rules
      </h2>
      <p className="mt-2 text-sm">
        Choose the products and categories each company may purchase. Market and
        channel restrictions also apply. Hold Ctrl or Command to select multiple
        entries.
      </p>
      <p role="alert">{error}</p>
      {companies.map((c) => (
        <form
          key={c.id}
          className="mt-4 grid gap-3 rounded bg-neutral-50 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const catalogPolicy: Record<string, unknown> = {};
            for (const key of ["markets", "channels"]) {
              const values = String(f.get(key) ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              if (values.length) catalogPolicy[key] = values;
            }
            for (const key of ["productIds", "variantIds", "categoryIds"]) {
              const values = f.getAll(key).map(String);
              if (values.length) catalogPolicy[key] = values;
            }
            if (
              f.get("restrictCatalog") === "on" &&
              !catalogPolicy.productIds &&
              !catalogPolicy.categoryIds
            )
              catalogPolicy.productIds = [];
            if (f.get("channel")) catalogPolicy.channel = f.get("channel");
            const purchaseSettings: Record<string, unknown> = {
              ...c.purchaseSettings,
            };
            for (const k of ["moq", "multiple", "caseSize", "leadTimeDays"])
              purchaseSettings[k] = Number(f.get(k));
            purchaseSettings.inventoryDisplay = f.get("inventoryDisplay");
            if (f.get("caseWeightGrams"))
              purchaseSettings.caseWeightGrams = Number(
                f.get("caseWeightGrams"),
              );
            else delete purchaseSettings.caseWeightGrams;
            purchaseSettings.reserveAt = f.get("reserveAt");
            purchaseSettings.requirePoNumber =
              f.get("requirePoNumber") === "on";
            purchaseSettings.orderSuspended = f.get("orderSuspended") === "on";
            purchaseSettings.requireMfa = f.get("requireMfa") === "on";
            purchaseSettings.currency = String(f.get("currency")).toUpperCase();
            purchaseSettings.paymentMethods = f.getAll("paymentMethods");
            void act(
              `/companies/${c.id}/policy`,
              { catalogPolicy, purchaseSettings, status: f.get("status") },
              "PUT",
            );
          }}
        >
          <h3 className="font-semibold sm:col-span-2">{c.companyName}</h3>
          <Link
            href={`/admin/dealers/company?id=${encodeURIComponent(c.id)}`}
            className="underline sm:col-span-2"
          >
            Manage company profile, team and addresses
          </Link>
          <label>
            <input
              name="restrictCatalog"
              type="checkbox"
              defaultChecked={
                Array.isArray(c.catalogPolicy.productIds) ||
                Array.isArray(c.catalogPolicy.categoryIds)
              }
            />{" "}
            Restrict catalog to selected products/categories (no selections
            denies all)
          </label>
          <label>
            Authorized products
            <select
              multiple
              name="productIds"
              className={input}
              defaultValue={
                Array.isArray(c.catalogPolicy.productIds)
                  ? c.catalogPolicy.productIds
                  : []
              }
            >
              {options.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Authorized variants
            <select
              multiple
              name="variantIds"
              className={input}
              defaultValue={
                Array.isArray(c.catalogPolicy.variantIds)
                  ? c.catalogPolicy.variantIds
                  : []
              }
            >
              {options.products.flatMap((p) =>
                p.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {p.name} · {v.sku}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            Authorized categories
            <select
              multiple
              name="categoryIds"
              className={input}
              defaultValue={
                Array.isArray(c.catalogPolicy.categoryIds)
                  ? c.catalogPolicy.categoryIds
                  : []
              }
            >
              {options.categories.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {["markets", "channels", "channel"].map((k) => (
            <label key={k}>
              {k} (comma separated)
              <input
                name={k}
                className={input}
                defaultValue={
                  Array.isArray(c.catalogPolicy[k])
                    ? (c.catalogPolicy[k] as string[]).join(",")
                    : String(c.catalogPolicy[k] ?? "")
                }
              />
            </label>
          ))}
          {["moq", "multiple", "caseSize", "leadTimeDays"].map((k) => (
            <label key={k}>
              {k}
              <input
                name={k}
                type="number"
                min={k === "leadTimeDays" ? 0 : 1}
                defaultValue={Number(
                  c.purchaseSettings[k] ?? (k === "leadTimeDays" ? 0 : 1),
                )}
                className={input}
              />
            </label>
          ))}
          <label>
            Case gross weight (g, optional)
            <input
              name="caseWeightGrams"
              type="number"
              min={1}
              max={100000}
              defaultValue={
                Number(c.purchaseSettings.caseWeightGrams) || undefined
              }
              className={input}
            />
          </label>
          <label>
            Inventory display
            <select
              name="inventoryDisplay"
              defaultValue={String(
                c.purchaseSettings.inventoryDisplay ?? "EXACT",
              )}
              className={input}
            >
              <option>EXACT</option>
              <option>STATUS</option>
              <option>HIDDEN</option>
            </select>
          </label>
          <label>
            Account status
            <select name="status" defaultValue={c.status} className={input}>
              <option>APPROVED</option>
              <option>SUSPENDED</option>
              <option>CLOSED</option>
            </select>
          </label>
          <label>
            <input
              name="requirePoNumber"
              type="checkbox"
              defaultChecked={c.purchaseSettings.requirePoNumber === true}
            />{" "}
            Require customer PO number
          </label>
          <label>
            Settlement currency
            <input
              name="currency"
              pattern="[A-Za-z]{3}"
              maxLength={3}
              defaultValue={String(c.purchaseSettings.currency ?? "USD")}
              required
              className={input}
            />
          </label>
          <label>
            Reserve inventory
            <select
              name="reserveAt"
              defaultValue={String(c.purchaseSettings.reserveAt ?? "SUBMIT")}
              className={input}
            >
              <option value="SUBMIT">When the dealer submits the order</option>
              <option value="CONFIRM">When staff confirms the order</option>
            </select>
          </label>
          <label>
            <input
              name="requireMfa"
              type="checkbox"
              defaultChecked={c.purchaseSettings.requireMfa === true}
            />{" "}
            Require MFA for dealer accounts
          </label>
          <label>
            <input
              name="orderSuspended"
              type="checkbox"
              defaultChecked={c.purchaseSettings.orderSuspended === true}
            />{" "}
            Pause new orders
          </label>
          <fieldset>
            <legend>Allowed payment methods</legend>
            {["BANK_TRANSFER", "PO", "ACCOUNT", "CARD"].map((m) => (
              <label className="mr-3" key={m}>
                <input
                  type="checkbox"
                  name="paymentMethods"
                  value={m}
                  defaultChecked={
                    (!Array.isArray(c.purchaseSettings.paymentMethods) &&
                      m !== "CARD") ||
                    (Array.isArray(c.purchaseSettings.paymentMethods) &&
                      (c.purchaseSettings.paymentMethods as string[]).includes(
                        m,
                      ))
                  }
                />
                {m}
              </label>
            ))}
          </fieldset>
          <button className={button} disabled={busy}>
            Save company policy
          </button>
        </form>
      ))}
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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-10"
    >
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
              Latest 100 requests. Amounts use the quoted settlement currency.
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
                  {rfq.targetDeliveryAt && (
                    <p className="mt-2 text-sm">
                      Target delivery:{" "}
                      {new Date(rfq.targetDeliveryAt).toLocaleDateString()}
                    </p>
                  )}
                  {rfq.rejectionReason && (
                    <p className="mt-2 text-sm">
                      Rejection reason: {rfq.rejectionReason}
                    </p>
                  )}
                  {rfq.attachmentIds?.map((id) => (
                    <button
                      key={id}
                      className="mr-3 underline"
                      onClick={async () => {
                        try {
                          const link = await secureApiFetch<{ url: string }>(
                            kind,
                            `/media/${id}/${admin ? "sign" : "access"}`,
                          );
                          window.open(
                            `/api/v1${link.url}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        } catch (e) {
                          handleError(e);
                        }
                      }}
                    >
                      RFQ attachment
                    </button>
                  ))}
                  <Lines
                    items={rfq.quotes[0]?.items ?? rfq.items}
                    currency={
                      rfq.quotes[0]?.currency ??
                      rfq.company?.purchaseSettings?.currency
                    }
                  />
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
                        {money(quote.totalCents, quote.currency)} · valid until{" "}
                        {new Date(quote.validUntil).toLocaleString()}
                      </summary>
                      <p className="mt-2 text-sm">
                        Tax {money(quote.taxCents, quote.currency)} · Shipping{" "}
                        {money(quote.shippingCents, quote.currency)}
                      </p>
                      <p className="mt-2 text-sm">
                        Discount{" "}
                        {money(quote.discountCents ?? 0, quote.currency)} ·
                        Payment {quote.paymentTerms} · {quote.deliveryTerms}
                      </p>
                      {index > 0 && (
                        <Lines items={quote.items} currency={quote.currency} />
                      )}
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
                    {admin && rfq.status === "QUOTED" && (
                      <AcceptForm rfq={rfq} act={act} busy={busy} admin />
                    )}
                    {!admin && canBuy && rfq.status === "QUOTED" && (
                      <>
                        <AcceptForm rfq={rfq} act={act} busy={busy} />
                        <button
                          disabled={busy}
                          onClick={() => {
                            const reason = window.prompt(
                              "Reason for declining this quote:",
                            );
                            if (reason?.trim())
                              void act(`/rfqs/${rfq.id}/reject`, {
                                version: rfq.revision,
                                reason,
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
                  <p className="mt-2 text-sm">
                    Customer PO: {order.customerPoNumber ?? "—"} ·{" "}
                    {order.paymentMethod} · {order.paymentTerms} ·{" "}
                    {order.paymentStatus}
                  </p>
                  {!admin &&
                    canBuy &&
                    order.paymentMethod === "CARD" &&
                    order.paymentStatus !== "PAID" &&
                    order.status === "PENDING_REVIEW" && (
                      <PayCard
                        order={order}
                        refresh={load}
                        onError={handleError}
                      />
                    )}
                  {admin &&
                    order.paymentMethod !== "CARD" &&
                    order.paymentStatus !== "PAID" &&
                    order.status !== "CANCELLED" && (
                      <form
                        className="mt-3 flex flex-wrap items-end gap-3 rounded border p-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          await act(
                            `/purchase-orders/${order.id}/offline-payment`,
                            {
                              amountCents: order.totalCents,
                              providerReference: f.get("reference"),
                              idempotencyKey: crypto.randomUUID(),
                            },
                          );
                        }}
                      >
                        <label>
                          Bank receipt / settlement reference
                          <input
                            name="reference"
                            required
                            minLength={3}
                            maxLength={160}
                            className={input}
                          />
                        </label>
                        <button disabled={busy} className={button}>
                          Confirm receipt of{" "}
                          {money(order.totalCents, order.currency)}
                        </button>
                      </form>
                    )}
                  <Lines items={order.items} currency={order.currency} />
                  <Link
                    href={
                      admin
                        ? `/admin/b2b/purchase-orders/${order.id}/after-sales`
                        : `/dealer/purchase-orders/${order.id}/after-sales`
                    }
                    className="mt-3 inline-block underline"
                  >
                    Returns, refunds & after-sales history
                  </Link>
                  <p className="mt-3 text-right font-semibold">
                    Total {money(order.totalCents, order.currency)}
                  </p>
                  <p className="mt-1 text-right text-sm">
                    Includes tax {money(order.taxCents, order.currency)} and
                    shipping {money(order.shippingCents, order.currency)}
                  </p>
                  <p className="mt-3 text-sm text-neutral-600">
                    Deliver to:{" "}
                    {Object.values(order.shippingAddress).join(", ")}
                  </p>
                  <p className="mt-1 text-sm">
                    Inventory:{" "}
                    {order.status === "CANCELLED"
                      ? "reservation released"
                      : order.inventoryReserved
                        ? "reservation recorded"
                        : "reserved after staff confirmation"}
                    {order.cancellationReason
                      ? ` · Cancellation reason: ${order.cancellationReason}`
                      : ""}
                  </p>
                  {order.adjustments?.map((entry, index) => (
                    <p key={index} className="mt-1 text-sm">
                      Adjustment {new Date(entry.at).toLocaleString()}:{" "}
                      {entry.reason}
                    </p>
                  ))}
                  {admin &&
                    ["PENDING_REVIEW", "CONFIRMED", "PROCESSING"].includes(
                      order.status,
                    ) &&
                    !order.items.some(
                      (item) => (item.shippedQuantity ?? 0) > 0,
                    ) && (
                      <details className="mt-4 rounded border p-3">
                        <summary className="cursor-pointer">
                          Adjust customer reference, terms or delivery details
                        </summary>
                        <form
                          className="mt-3 grid gap-3 sm:grid-cols-2"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            const f = new FormData(event.currentTarget);
                            const address = (prefix: string) =>
                              Object.fromEntries(
                                [
                                  "recipient",
                                  "phone",
                                  "country",
                                  "city",
                                  "addressLine",
                                  "postalCode",
                                ].map((key) => [
                                  key,
                                  String(f.get(`${prefix}.${key}`)),
                                ]),
                              );
                            await act(
                              `/purchase-orders/${order.id}/adjust`,
                              {
                                reason: f.get("reason"),
                                customerPoNumber: f.get("customerPoNumber"),
                                paymentTerms: f.get("paymentTerms"),
                                shippingAddress: address("shipping"),
                                billingAddress: address("billing"),
                              },
                              "PATCH",
                            );
                          }}
                        >
                          <label>
                            Customer PO number
                            <input
                              name="customerPoNumber"
                              defaultValue={order.customerPoNumber ?? ""}
                              className={input}
                            />
                          </label>
                          <label>
                            Payment terms
                            <input
                              name="paymentTerms"
                              required
                              defaultValue={order.paymentTerms}
                              className={input}
                            />
                          </label>
                          {(["shipping", "billing"] as const).map((prefix) => (
                            <fieldset key={prefix} className="space-y-2">
                              <legend className="font-semibold capitalize">
                                {prefix} address
                              </legend>
                              {[
                                "recipient",
                                "phone",
                                "country",
                                "city",
                                "addressLine",
                                "postalCode",
                              ].map((key) => (
                                <label key={key} className="block text-sm">
                                  {key}
                                  <input
                                    name={`${prefix}.${key}`}
                                    required
                                    maxLength={key === "country" ? 2 : 300}
                                    defaultValue={
                                      (prefix === "shipping"
                                        ? order.shippingAddress
                                        : order.billingAddress)[key] ?? ""
                                    }
                                    className={input}
                                  />
                                </label>
                              ))}
                            </fieldset>
                          ))}
                          <label className="sm:col-span-2">
                            Adjustment reason
                            <textarea
                              name="reason"
                              required
                              maxLength={1000}
                              className={input}
                            />
                          </label>
                          <button disabled={busy} className={button}>
                            Save adjustment with audit record
                          </button>
                        </form>
                      </details>
                    )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {["confirmation", "quote", "invoice", "packing-list"].map(
                      (document) => (
                        <button
                          key={document}
                          className="underline"
                          onClick={async () => {
                            try {
                              const d = await secureApiFetch<{
                                base64: string;
                                fileName: string;
                              }>(
                                kind,
                                `${base}/purchase-orders/${order.id}/documents/${document}`,
                              );
                              const bytes = Uint8Array.from(
                                atob(d.base64),
                                (c) => c.charCodeAt(0),
                              );
                              const url = URL.createObjectURL(
                                new Blob([bytes], { type: "application/pdf" }),
                              );
                              const a = window.document.createElement("a");
                              a.href = url;
                              a.download = d.fileName;
                              a.click();
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                            } catch (e) {
                              handleError(e);
                            }
                          }}
                        >
                          {document} PDF
                        </button>
                      ),
                    )}
                    {!admin && canBuy && (
                      <button
                        className="underline"
                        disabled={busy}
                        onClick={async () => {
                          try {
                            const result = await secureApiFetch<{
                              valid: boolean;
                              results: Array<{ sku: string; message?: string }>;
                            }>(
                              "dealer",
                              `/dealer/purchase-orders/${order.id}/reorder`,
                              { method: "POST", body: "{}" },
                            );
                            if (result.valid) {
                              setNotice(
                                "Current prices and stock checked; reorder saved to procurement cart.",
                              );
                              router.push("/dealer/quick-order");
                            } else
                              setError(
                                result.results
                                  .filter((r) => r.message)
                                  .map((r) => `${r.sku}: ${r.message}`)
                                  .join("; "),
                              );
                          } catch (e) {
                            handleError(e);
                          }
                        }}
                      >
                        Reorder with current prices
                      </button>
                    )}
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
                          const reason =
                            status === "CANCELLED"
                              ? window
                                  .prompt(
                                    "Reason for cancelling this purchase order:",
                                  )
                                  ?.trim()
                              : undefined;
                          if (status === "CANCELLED" && !reason) return;
                          if (
                            window.confirm(
                              `Change purchase order to ${status}?`,
                            )
                          )
                            void act(
                              `/purchase-orders/${order.id}/${admin ? "status" : "cancel"}`,
                              admin ? { status, reason } : { reason },
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
                  {order.shipments?.map((s) => (
                    <p key={s.id} className="mt-3 text-sm">
                      Shipment: {s.carrier} · {s.trackingNumber} ·{" "}
                      {s.lines.map((l) => `${l.sku}: ${l.quantity}`).join(", ")}
                    </p>
                  ))}
                  {admin &&
                    ["CONFIRMED", "PROCESSING"].includes(order.status) && (
                      <form
                        className="mt-5 grid gap-3 rounded bg-neutral-50 p-4 sm:grid-cols-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          await act(`/purchase-orders/${order.id}/shipments`, {
                            carrier: f.get("carrier"),
                            trackingNumber: f.get("tracking"),
                            dedupeKey: crypto.randomUUID(),
                            lines: order.items
                              .map((i) => ({
                                sku: i.sku,
                                quantity: Number(f.get(i.sku)),
                              }))
                              .filter((i) => i.quantity > 0),
                          });
                        }}
                      >
                        <h4 className="font-semibold sm:col-span-2">
                          Record partial shipment
                        </h4>
                        <label>
                          Carrier
                          <input className={input} name="carrier" required />
                        </label>
                        <label>
                          Tracking number
                          <input className={input} name="tracking" required />
                        </label>
                        {order.items.map((i) => (
                          <label key={i.sku}>
                            {i.sku} quantity
                            <input
                              className={input}
                              name={i.sku}
                              type="number"
                              min="0"
                              max={i.quantity}
                              defaultValue="0"
                            />
                          </label>
                        ))}
                        <button className={button} disabled={busy}>
                          Record shipment
                        </button>
                      </form>
                    )}
                </article>
              ))}
            </div>
          </section>
          {admin && <PriceBooks books={books} act={act} busy={busy} />}
          {admin && <CompanyPolicies act={act} busy={busy} />}
        </>
      )}
    </main>
  );
}

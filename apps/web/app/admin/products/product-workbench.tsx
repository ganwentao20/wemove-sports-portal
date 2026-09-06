"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type Variant = {
  id: string;
  sku: string;
  name: string | null;
  msrpCents: number | null;
  salePriceCents: number | null;
  b2bDefaultPriceCents: number | null;
  status: boolean;
  stock: { available: number; reserved: number } | null;
};
type Product = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  category: { id: string; name: string } | null;
  variants: Variant[];
};
type Category = {
  id: string;
  code: string;
  name: string;
  slug: string;
  active: boolean;
};
type ProductPage = { items: Product[]; total: number };

export function ProductWorkbench() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productPage, categoryList] = await Promise.all([
        secureApiFetch<ProductPage>(
          "staff",
          "/admin/catalog/products?page=1&pageSize=100",
        ),
        secureApiFetch<Category[]>("staff", "/admin/catalog/categories"),
      ]);
      setProducts(productPage.items);
      setCategories(categoryList);
      if (!selectedProductId && productPage.items[0])
        setSelectedProductId(productPage.items[0].id);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("staff").catch(() => undefined);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load catalog.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, selectedProductId]);

  useEffect(() => {
    void load();
  }, [load]);

  function mfaHeaders(): HeadersInit | null {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the current 6-digit MFA code before saving changes.");
      return null;
    }
    return { "x-mfa-code": mfaCode };
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const headers = mfaHeaders();
    if (!headers) return;
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await secureApiFetch("staff", "/admin/catalog/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          slug: String(form.get("slug") ?? "")
            .trim()
            .toLowerCase(),
          categoryId: String(form.get("categoryId") ?? "") || undefined,
          status: String(form.get("status") ?? "DRAFT"),
        }),
      });
      formElement.reset();
      setMfaCode("");
      setNotice("Product created.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to create product.",
      );
    }
  }

  async function createVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const headers = mfaHeaders();
    if (!headers || !selectedProductId) return;
    const form = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value ? Number(value) : undefined;
    };
    setError("");
    try {
      await secureApiFetch(
        "staff",
        `/admin/catalog/products/${selectedProductId}/variants`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            sku: String(form.get("sku") ?? "").trim(),
            name: String(form.get("name") ?? "").trim() || undefined,
            msrpCents: optionalNumber("msrpCents"),
            salePriceCents: optionalNumber("salePriceCents"),
            b2bDefaultPriceCents: optionalNumber("b2bDefaultPriceCents"),
            available: Number(form.get("available") ?? 0),
          }),
        },
      );
      formElement.reset();
      setMfaCode("");
      setNotice("SKU created with its initial stock.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to create SKU.",
      );
    }
  }

  async function updateProductStatus(product: Product, status: ProductStatus) {
    const headers = mfaHeaders();
    if (!headers) return;
    if (
      !window.confirm(
        `Change ${product.name} from ${product.status} to ${status}?`,
      )
    )
      return;
    try {
      await secureApiFetch("staff", `/admin/catalog/products/${product.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      setMfaCode("");
      setNotice("Product status updated.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to update product.",
      );
    }
  }

  async function updateStock(variant: Variant, available: number) {
    const headers = mfaHeaders();
    if (!headers || !Number.isInteger(available) || available < 0) return;
    try {
      await secureApiFetch("staff", `/admin/catalog/variants/${variant.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ available }),
      });
      setMfaCode("");
      setNotice(`Stock updated for ${variant.sku}.`);
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to update stock.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
          <h1 className="mt-1 text-3xl font-bold">Products & SKUs</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Manage publish status, retail/wholesale prices and available stock.
          </p>
        </div>
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={createProduct} className="rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">Create product</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              required
              maxLength={160}
              placeholder="Product name"
              className="rounded-lg border px-3 py-2"
            />
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={120}
              placeholder="product-slug"
              className="rounded-lg border px-3 py-2"
            />
            <select
              name="categoryId"
              className="rounded-lg border bg-white px-3 py-2"
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              className="rounded-lg border bg-white px-3 py-2"
            >
              <option>DRAFT</option>
              <option>ACTIVE</option>
            </select>
          </div>
          <button className="mt-4 rounded-lg bg-[var(--wm-dark)] px-4 py-2 text-sm font-semibold text-white">
            Create product
          </button>
        </form>

        <form onSubmit={createVariant} className="rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">Add SKU</h2>
          <select
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            required
            className="mt-4 w-full rounded-lg border bg-white px-3 py-2"
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              name="sku"
              required
              maxLength={80}
              placeholder="SKU"
              className="rounded-lg border px-3 py-2"
            />
            <input
              name="name"
              maxLength={120}
              placeholder="Variant name"
              className="rounded-lg border px-3 py-2"
            />
            <input
              name="msrpCents"
              type="number"
              min={0}
              placeholder="MSRP cents"
              className="rounded-lg border px-3 py-2"
            />
            <input
              name="salePriceCents"
              type="number"
              min={0}
              placeholder="Sale cents"
              className="rounded-lg border px-3 py-2"
            />
            <input
              name="b2bDefaultPriceCents"
              type="number"
              min={0}
              placeholder="B2B cents"
              className="rounded-lg border px-3 py-2"
            />
            <input
              name="available"
              type="number"
              min={0}
              defaultValue={0}
              placeholder="Available stock"
              className="rounded-lg border px-3 py-2"
            />
          </div>
          <button
            disabled={!selectedProductId}
            className="mt-4 rounded-lg bg-[var(--wm-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add SKU
          </button>
        </form>
      </div>

      {loading ? (
        <p className="mt-8 text-neutral-500">Loading products…</p>
      ) : (
        <div className="mt-8 space-y-4">
          {products.map((product) => (
            <article key={product.id} className="rounded-2xl border p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{product.name}</h2>
                  <p className="text-xs text-neutral-500">
                    /{product.slug} ·{" "}
                    {product.category?.name ?? "Uncategorized"}
                  </p>
                </div>
                <select
                  value={product.status}
                  onChange={(event) =>
                    void updateProductStatus(
                      product,
                      event.target.value as ProductStatus,
                    )
                  }
                  className="rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  <option>DRAFT</option>
                  <option>ACTIVE</option>
                  <option>ARCHIVED</option>
                </select>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="text-xs text-neutral-500">
                    <tr>
                      <th className="py-2">SKU</th>
                      <th>Name</th>
                      <th>MSRP</th>
                      <th>Sale</th>
                      <th>B2B</th>
                      <th>Reserved</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant) => (
                      <tr key={variant.id} className="border-t">
                        <td className="py-3 font-medium">{variant.sku}</td>
                        <td>{variant.name}</td>
                        <td>{variant.msrpCents ?? "—"}</td>
                        <td>{variant.salePriceCents ?? "—"}</td>
                        <td>{variant.b2bDefaultPriceCents ?? "—"}</td>
                        <td>{variant.stock?.reserved ?? 0}</td>
                        <td>
                          <input
                            key={`${variant.id}-${variant.stock?.available ?? 0}`}
                            type="number"
                            min={0}
                            defaultValue={variant.stock?.available ?? 0}
                            onBlur={(event) => {
                              const next = Number(event.target.value);
                              if (next !== (variant.stock?.available ?? 0))
                                void updateStock(variant, next);
                            }}
                            className="w-24 rounded border px-2 py-1"
                            aria-label={`Available stock for ${variant.sku}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

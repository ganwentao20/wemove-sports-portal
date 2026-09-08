"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { ProductRatingEditor } from "./product-rating-editor";
import { useEffect, useState, type FormEvent } from "react";
import { ProductTranslations } from "./product-translations";
import { ProductSeoFields } from "./product-seo-fields";
import { CategoryEditor, type CategoryData } from "./category-editor";
import { secureApiFetch } from "../../../lib/secure-api";
import {
  VariantInventory,
  type VariantInventoryData,
} from "./variant-inventory";
type Product = {
  id: string;
  category?: { id: string } | null;
  name: string;
  slug: string;
  summary?: string;
  description?: string;
  ageGuidance?: string;
  status: string;
  ageMin: number | null;
  ageMax: number | null;
  scenes: string[];
  skills: string[];
  tags: string[];
  markets: string[];
  publishAt: string | null;
  unpublishAt: string | null;
  specifications: Record<string, unknown>;
  seo: Record<string, unknown>;
  playGuide: string | null;
  productFaq: Array<{ question: string; answer: string }>;
  gallery: Array<{
    url: string;
    alt: string;
    type?: string;
    locale?: string;
    market?: string;
  }>;
  relatedSlugs: string[];
  associations?: Array<{ type: string; slug: string }>;
  archiveRedirect: string | null;
  variants: Array<
    VariantInventoryData & {
      id: string;
      sku: string;
      barcode: string | null;
      attrs: Record<string, unknown>;
      stock: {
        available: number;
        reserved: number;
        lowThreshold: number;
        source: string;
        syncError?: string;
      } | null;
      marketPrices: Record<
        string,
        { currency: string; msrpCents?: number; salePriceCents?: number }
      >;
    }
  >;
};
type Category = CategoryData & {
  id: string;
  name: string;
  attributeTemplate: Array<{
    key: string;
    label: string;
    type: string;
    locale?: string;
    market?: string;
    required?: boolean;
  }>;
  filterableFields: string[];
};
type Row = {
  slug: string;
  name: string;
  sku: string;
  msrpCents: number;
  available: number;
  status: string;
  categorySlug?: string;
  tags?: string[];
};
const input = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
const button =
  "rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-40";
const list = (s: FormDataEntryValue | null) =>
  String(s ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quote = !quote;
    } else if (c === "," && !quote) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quote) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quote) throw new Error("CSV contains an unclosed quote");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  const headers =
    rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) ?? [];
  if (
    !["slug", "name", "sku", "msrpCents", "available"].every((h) =>
      headers.includes(h),
    )
  )
    throw new Error(
      "Required columns: slug, name, sku, msrpCents, available, status",
    );
  return rows.map((values, index) => {
    const r = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    const price = Number(r.msrpCents),
      stock = Number(r.available);
    if (
      !Number.isInteger(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    )
      throw new Error(
        `Row ${index + 2}: prices and quantities must be nonnegative integers`,
      );
    return {
      slug: r.slug,
      name: r.name,
      sku: r.sku,
      msrpCents: price,
      available: stock,
      status: r.status || "DRAFT",
      ...(headers.includes("categorySlug")
        ? { categorySlug: r.categorySlug.trim() }
        : {}),
      ...(headers.includes("tags")
        ? {
            tags: r.tags
              .split("|")
              .map((t) => t.trim())
              .filter(Boolean),
          }
        : {}),
    };
  });
}
export function ProductMerchandising() {
  const t = useUiText();
  const uiLocale = useUiLocale();

  const [inventoryAlerts, setInventoryAlerts] = useState<
    Array<{
      variantId: string;
      variant: { sku: string };
      available: number;
      reserved: number;
      lowThreshold: number;
      syncError?: string;
    }>
  >([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mfa, setMfa] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<Product["gallery"]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<{
    rows: number;
    creates: number;
    updates: number;
    errors: string[];
    applied: boolean;
  } | null>(null);
  const product = products.find((p) => p.id === selectedId);
  async function load() {
    try {
      const [p, c, alerts] = await Promise.all([
        secureApiFetch<{ items: Product[] }>(
          "staff",
          "/admin/catalog/products?pageSize=100",
        ),
        secureApiFetch<Category[]>("staff", "/admin/catalog/categories"),
        secureApiFetch<typeof inventoryAlerts>(
          "staff",
          "/admin/commerce/inventory-alerts",
        ),
      ]);
      setProducts(p.items);
      setCategories(c);
      setInventoryAlerts(alerts);
      if (!selectedId && p.items[0]) {
        setSelectedId(p.items[0].id);
        setGallery(p.items[0].gallery ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function call(path: string, body: unknown, method = "PATCH") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await secureApiFetch<any>("staff", path, {
        method,
        headers: { "x-mfa-code": mfa },
        body: JSON.stringify(body),
      });
      setNotice("Saved.");
      await load();
      return data;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;
    const f = new FormData(e.currentTarget);
    const specs: Record<string, unknown> = {};
    for (const line of String(f.get("specs") ?? "")
      .split("\n")
      .filter(Boolean)) {
      const pos = line.indexOf("=");
      if (pos < 1) {
        setError("Each specification must have a name = value");
        return;
      }
      const key = line.slice(0, pos).trim(),
        raw = line.slice(pos + 1).trim();
      const type = categories
        .find((c) => c.id === product.category?.id)
        ?.attributeTemplate?.find((a) => a.key === key)?.type;
      specs[key] =
        type === "number"
          ? Number(raw)
          : type === "boolean"
            ? raw === "true"
            : raw;
    }
    specs.translations = JSON.parse(String(f.get("translations") ?? "{}"));
    await call(`/admin/catalog/products/${product.id}`, {
      name: f.get("name"),
      slug: f.get("slug"),
      summary: f.get("summary"),
      description: f.get("description"),
      ageGuidance: f.get("ageGuidance"),
      status: f.get("status"),
      ageMin: f.get("ageMin") !== "" ? Number(f.get("ageMin")) : undefined,
      ageMax: f.get("ageMax") !== "" ? Number(f.get("ageMax")) : undefined,
      scenes: list(f.get("scenes")),
      skills: list(f.get("skills")),
      tags: list(f.get("tags")),
      markets: list(f.get("markets")).map((v) => v.toUpperCase()),
      publishAt: f.get("publishAt")
        ? new Date(String(f.get("publishAt"))).toISOString()
        : null,
      unpublishAt: f.get("unpublishAt")
        ? new Date(String(f.get("unpublishAt"))).toISOString()
        : null,
      relatedSlugs: list(f.get("relatedSlugs")),
      associations: [
        ...list(f.get("relatedSlugs")).map((slug) => ({
          type: "RELATED",
          slug,
        })),
        ...list(f.get("accessorySlugs")).map((slug) => ({
          type: "ACCESSORY",
          slug,
        })),
        ...list(f.get("replacementSlugs")).map((slug) => ({
          type: "REPLACEMENT",
          slug,
        })),
      ],
      archiveRedirect: f.get("archiveRedirect") || undefined,
      playGuide: f.get("playGuide"),
      specifications: specs,
      seo: {
        ...Object.fromEntries(
          [
            "title",
            "description",
            "ogTitle",
            "ogDescription",
            "ogImage",
            "canonical",
          ].map((key) => [key, String(f.get(`seo-${key}`) ?? "")]),
        ),
        noindex: f.get("seo-noindex") === "on",
      },
      productFaq: String(f.get("faq") ?? "")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [question, ...answer] = line.split("|");
          return { question: question.trim(), answer: answer.join("|").trim() };
        }),
      gallery,
    });
  }
  async function exportCsv() {
    try {
      const data = await secureApiFetch<{ csv: string; fileName: string }>(
        "staff",
        "/admin/catalog/export",
      );
      const url = URL.createObjectURL(
        new Blob([data.csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="mx-auto max-w-7xl px-4 pb-12">
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold">
          {t("Product content & merchandising")}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          {t(
            "Edit structured fields, publish windows, media and market prices. Copies start as drafts with zero inventory.",
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-4 bg-red-50 p-4 text-red-800">
          {error ? uiError(uiLocale, error) : ""}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 bg-green-50 p-4">
          {notice ? uiError(uiLocale, notice) : ""}
        </p>
      )}
      {inventoryAlerts.length > 0 && (
        <details className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <summary className="cursor-pointer font-semibold">
            {t("Inventory alerts (")}
            {inventoryAlerts.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {inventoryAlerts.map((a) => (
              <li key={a.variantId}>
                <strong>{a.variant.sku}</strong>:{" "}
                {a.syncError
                  ? t("Source synchronization failed — checkout blocked")
                  : t("{value1} available / threshold {value2}", {
                      value1: a.available,
                      value2: a.lowThreshold,
                    })}{" "}
                · {a.reserved} {t("reserved")}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          {t("Product")}
          <select
            className={input}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setGallery(
                products.find((p) => p.id === e.target.value)?.gallery ?? [],
              );
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {t(String(p.status))}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Current MFA code")}
          <input
            className={input}
            inputMode="numeric"
            maxLength={6}
            value={mfa}
            onChange={(e) => setMfa(e.target.value)}
          />
        </label>
      </div>
      {product && (
        <>
          <form
            key={product.id}
            onSubmit={save}
            className="mt-5 grid gap-4 rounded-xl border p-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[
              ["name", "Name", product.name],
              ["slug", "URL slug", product.slug],
              ["summary", "Summary", product.summary],
              [
                "ageGuidance",
                "Age & supervision guidance",
                product.ageGuidance,
              ],
              ["ageMin", "Minimum age", product.ageMin],
              ["ageMax", "Maximum age", product.ageMax],
              [
                "scenes",
                "Scenes (comma separated)",
                product.scenes?.join(", "),
              ],
              ["skills", "Skills", product.skills?.join(", ")],
              ["tags", "Tags", product.tags?.join(", ")],
              ["markets", "Markets (blank = all)", product.markets?.join(", ")],
              [
                "relatedSlugs",
                "Related product slugs",
                [
                  ...new Set([
                    ...(product.relatedSlugs ?? []),
                    ...(product.associations ?? [])
                      .filter((a) => a.type === "RELATED")
                      .map((a) => a.slug),
                  ]),
                ].join(", "),
              ],
              [
                "accessorySlugs",
                "Accessory product slugs",
                product.associations
                  ?.filter((a) => a.type === "ACCESSORY")
                  .map((a) => a.slug)
                  .join(", "),
              ],
              [
                "replacementSlugs",
                "Replacement part slugs",
                product.associations
                  ?.filter((a) => a.type === "REPLACEMENT")
                  .map((a) => a.slug)
                  .join(", "),
              ],
              [
                "archiveRedirect",
                "Archive redirect path",
                product.archiveRedirect,
              ],
            ].map(([name, label, value]) => (
              <label key={String(name)}>
                {t(String(label))}
                <input
                  name={String(name)}
                  className={input}
                  defaultValue={value ?? ""}
                />
              </label>
            ))}
            <label>
              {t("Status")}
              <select
                name="status"
                className={input}
                defaultValue={product.status}
              >
                {["DRAFT", "SCHEDULED", "ACTIVE", "HIDDEN", "ARCHIVED"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {t(String(s))}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              {t("Publish at")}
              <input
                name="publishAt"
                type="datetime-local"
                className={input}
                defaultValue={product.publishAt?.slice(0, 16) ?? ""}
              />
            </label>
            <label>
              {t("Unpublish at")}
              <input
                name="unpublishAt"
                type="datetime-local"
                className={input}
                defaultValue={product.unpublishAt?.slice(0, 16) ?? ""}
              />
            </label>
            <label className="sm:col-span-2">
              {t("Description")}
              <textarea
                name="description"
                className={input}
                rows={4}
                defaultValue={product.description ?? ""}
              />
            </label>
            <label>
              {t("Specification table (name = value, one per line)")}
              <textarea
                name="specs"
                className={input}
                rows={5}
                defaultValue={Object.entries(product.specifications ?? {})
                  .filter(
                    ([k, v]) =>
                      k !== "translations" &&
                      ["string", "number", "boolean"].includes(typeof v),
                  )
                  .map(([k, v]) => `${k} = ${v}`)
                  .join("\n")}
              />
            </label>
            <label className="sm:col-span-2">
              {t("Setup, how to play, care & safety")}
              <textarea
                name="playGuide"
                className={input}
                rows={5}
                defaultValue={product.playGuide ?? ""}
              />
            </label>
            <label>
              {t("FAQ (question | answer, one per line)")}
              <textarea
                name="faq"
                className={input}
                rows={5}
                defaultValue={
                  product.productFaq
                    ?.map((f) => `${f.question} | ${f.answer}`)
                    .join("\n") ?? ""
                }
              />
            </label>
            <ProductTranslations key={product.id} source={product} />
            <ProductSeoFields prefix="seo" value={product.seo ?? {}} />
            <section className="sm:col-span-2 lg:col-span-3">
              <h3 className="font-bold">
                {t("Gallery order & accessible descriptions")}
              </h3>
              {gallery.map((item, index) => (
                <div
                  className="mt-3 grid gap-2 rounded-lg border p-3 md:grid-cols-3"
                  key={index}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/wemove-gallery-index",
                      String(index),
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const raw = event.dataTransfer.getData(
                      "application/wemove-gallery-index",
                    );
                    if (!/^\d+$/.test(raw)) return;
                    const from = Number(raw);
                    if (from < 0 || from >= gallery.length || from === index)
                      return;
                    const moved = [...gallery];
                    const [item] = moved.splice(from, 1);
                    moved.splice(index, 0, item);
                    setGallery(moved);
                  }}
                >
                  <label>
                    {t("Image or video URL")}
                    <input
                      className={input}
                      value={item.url}
                      onChange={(e) =>
                        setGallery(
                          gallery.map((g, i) =>
                            i === index ? { ...g, url: e.target.value } : g,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {t("Alt text")}
                    <input
                      className={input}
                      value={item.alt}
                      onChange={(e) =>
                        setGallery(
                          gallery.map((g, i) =>
                            i === index ? { ...g, alt: e.target.value } : g,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {t("Type")}
                    <select
                      className={input}
                      value={item.type ?? "image"}
                      onChange={(e) =>
                        setGallery(
                          gallery.map((g, i) =>
                            i === index ? { ...g, type: e.target.value } : g,
                          ),
                        )
                      }
                    >
                      <option value="image">{t("image")}</option>
                      <option value="video">{t("video")}</option>
                    </select>
                  </label>
                  <div className="flex gap-2 self-end">
                    <span className="self-center text-xs text-neutral-600">
                      {t("Drag row to reorder")}
                    </span>
                    <button
                      type="button"
                      className={button}
                      disabled={!index}
                      aria-label={t("Move media {value1} earlier", {
                        value1: index + 1,
                      })}
                      onClick={() => {
                        const g = [...gallery];
                        [g[index - 1], g[index]] = [g[index], g[index - 1]];
                        setGallery(g);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={button}
                      onClick={() =>
                        setGallery(gallery.filter((_, i) => i !== index))
                      }
                    >
                      {t("Remove")}
                    </button>
                  </div>
                  <label>
                    {t("Language (blank = all)")}
                    <input
                      className={input}
                      placeholder={t("en, zh, fr, de, zh-CN")}
                      pattern="[a-z]{2,3}(-[A-Z]{2})?"
                      value={item.locale ?? ""}
                      onChange={(e) =>
                        setGallery(
                          gallery.map((g, i) =>
                            i === index ? { ...g, locale: e.target.value } : g,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {t("Market (blank = all)")}
                    <input
                      className={input}
                      value={item.market ?? ""}
                      maxLength={2}
                      onChange={(e) =>
                        setGallery(
                          gallery.map((g, i) =>
                            i === index
                              ? { ...g, market: e.target.value.toUpperCase() }
                              : g,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className={`${button} mt-3`}
                onClick={() =>
                  setGallery([...gallery, { url: "", alt: "", type: "image" }])
                }
              >
                {t("Add media")}
              </button>
            </section>
            <button className={button} disabled={busy}>
              {t("Save product content")}
            </button>
          </form>
          <form
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void call(
                `/admin/catalog/products/${product.id}/copy`,
                { slug: f.get("slug"), skuPrefix: f.get("skuPrefix") },
                "POST",
              );
            }}
          >
            <label>
              {t("New copy slug")}
              <input className={input} name="slug" required />
            </label>
            <label>
              {t("New SKU prefix")}
              <input className={input} name="skuPrefix" required />
            </label>
            <button className={button} disabled={busy}>
              {t("Duplicate as draft")}
            </button>
          </form>
          <h3 className="mt-6 text-xl font-bold">
            {t("SKU market prices & barcodes")}
          </h3>
          {product.variants.map((v) => (
            <form
              key={v.id}
              className="mt-3 grid gap-3 rounded-xl border p-5 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const code = String(f.get("market")).toUpperCase();
                const price = {
                  ...v.marketPrices,
                  [code]: {
                    currency: String(f.get("currency")).toUpperCase(),
                    msrpCents: Math.round(Number(f.get("msrp")) * 100),
                    ...(f.get("sale")
                      ? {
                          salePriceCents: Math.round(
                            Number(f.get("sale")) * 100,
                          ),
                        }
                      : {}),
                    ...(f.get("start")
                      ? {
                          startsAt: new Date(
                            String(f.get("start")),
                          ).toISOString(),
                        }
                      : {}),
                    ...(f.get("end")
                      ? { endsAt: new Date(String(f.get("end"))).toISOString() }
                      : {}),
                  },
                };
                void call(`/admin/catalog/variants/${v.id}`, {
                  barcode: f.get("barcode"),
                  marketPrices: price,
                  attrs: {
                    ...v.attrs,
                    ...Object.fromEntries(
                      String(f.get("attrs") ?? "")
                        .split("\n")
                        .filter(Boolean)
                        .map((line) => {
                          const [key, ...value] = line.split("=");
                          return [key.trim(), value.join("=").trim()];
                        }),
                    ),
                    gallery: String(f.get("gallery") ?? "")
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => {
                        const [url, alt, type, locale, market] = line
                          .split("|")
                          .map((s) => s.trim());
                        return {
                          url,
                          alt: alt || v.sku,
                          type: type || "image",
                          locale: locale || undefined,
                          market: market ? market.toUpperCase() : undefined,
                        };
                      }),
                  },
                });
              }}
            >
              <strong className="sm:col-span-3">
                {v.sku} · {v.id}
              </strong>
              <label>
                {t("Barcode")}
                <input
                  className={input}
                  name="barcode"
                  defaultValue={v.barcode ?? ""}
                />
              </label>
              <label>
                {t("Market")}
                <input
                  className={input}
                  name="market"
                  defaultValue="US"
                  maxLength={2}
                  required
                />
              </label>
              <label>
                {t("Currency")}
                <input
                  className={input}
                  name="currency"
                  defaultValue="USD"
                  maxLength={3}
                  required
                />
              </label>
              <label>
                {t("MSRP")}
                <input
                  className={input}
                  name="msrp"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
              <label>
                {t("Sale price (optional)")}
                <input
                  className={input}
                  name="sale"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
              <label>
                {t("Valid from")}
                <input className={input} name="start" type="datetime-local" />
              </label>
              <label>
                {t("Valid until")}
                <input className={input} name="end" type="datetime-local" />
              </label>
              <label>
                {t("Variant specifications (name = value)")}
                <textarea
                  className={input}
                  name="attrs"
                  rows={3}
                  defaultValue={Object.entries(v.attrs ?? {})
                    .filter(
                      ([key, value]) =>
                        key !== "gallery" &&
                        ["string", "number", "boolean"].includes(typeof value),
                    )
                    .map(([key, value]) => `${key} = ${value}`)
                    .join("\n")}
                />
              </label>
              <label>
                {t(
                  "Variant media (URL | alt text | image/video | language | market)",
                )}
                <textarea
                  className={input}
                  name="gallery"
                  rows={3}
                  defaultValue={
                    Array.isArray(v.attrs?.gallery)
                      ? (
                          v.attrs.gallery as Array<{
                            url: string;
                            alt: string;
                            type: string;
                            locale?: string;
                            market?: string;
                          }>
                        )
                          .map(
                            (g) =>
                              `${g.url} | ${g.alt} | ${g.type ?? "image"} | ${g.locale ?? ""} | ${g.market ?? ""}`,
                          )
                          .join("\n")
                      : ""
                  }
                />
              </label>
              <button className={`${button} self-end`} disabled={busy}>
                {t("Save market price")}
              </button>
              <button
                type="button"
                className={`${button} self-end`}
                onClick={async () => {
                  try {
                    const rows = await secureApiFetch<
                      Array<{
                        createdAt: string;
                        actorId: string;
                        after: Record<string, unknown>;
                      }>
                    >("staff", `/admin/catalog/variants/${v.id}/price-history`);
                    setNotice(
                      rows.length
                        ? rows
                            .map((r) =>
                              t("{date} · Staff {staff}", {
                                date: new Date(r.createdAt).toLocaleString(
                                  uiLocale === "zh" ? "zh-CN" : "en-US",
                                ),
                                staff: r.actorId,
                              }),
                            )
                            .join(" | ")
                        : "No recorded price changes.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {t("Price change history")}
              </button>
            </form>
          ))}
          <h3 className="mt-6 text-xl font-bold">
            {t("Inventory source & low stock policy")}
          </h3>
          {product.variants.map((variant) => (
            <VariantInventory
              key={variant.id}
              variant={variant}
              busy={busy}
              save={call}
            />
          ))}
          {product.variants.map((v) => (
            <form
              key={`stock-${v.id}`}
              className="mt-3 grid gap-3 rounded-xl border p-5 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const error = String(f.get("syncError") ?? "").trim();
                void call(`/admin/catalog/variants/${v.id}`, {
                  lowThreshold: Number(f.get("threshold")),
                  inventorySource: f.get("source"),
                  ...(error
                    ? { syncError: error }
                    : { available: Number(f.get("available")), syncError: "" }),
                });
              }}
            >
              <strong className="sm:col-span-4">
                {v.sku} {t("· Reserved:")}
                {v.stock?.reserved ?? 0}
              </strong>
              <label>
                {t("Available units")}
                <input
                  className={input}
                  name="available"
                  type="number"
                  min={0}
                  defaultValue={v.stock?.available ?? 0}
                />
              </label>
              <label>
                {t("Low stock threshold")}
                <input
                  className={input}
                  name="threshold"
                  type="number"
                  min={0}
                  defaultValue={v.stock?.lowThreshold ?? 5}
                />
              </label>
              <label>
                {t("Inventory source")}
                <input
                  className={input}
                  name="source"
                  defaultValue={v.stock?.source ?? "MANUAL"}
                />
              </label>
              <label>
                {t("Source sync failure (blank = healthy)")}
                <input
                  className={input}
                  name="syncError"
                  defaultValue={v.stock?.syncError ?? ""}
                />
              </label>
              <p className="text-sm text-neutral-600 sm:col-span-4">
                {t(
                  "A reported source failure preserves quantities and blocks new checkout until a healthy stock update is recorded.",
                )}
              </p>
              <button className={button} disabled={busy}>
                {t("Save inventory policy")}
              </button>
            </form>
          ))}
        </>
      )}
      {product && (
        <ProductRatingEditor
          productId={product.id}
          value={product.specifications.reviews}
          mfa={mfa}
          onSaved={load}
        />
      )}
      <CategoryEditor categories={categories} mfa={mfa} onSaved={load} />
      <section className="mt-8">
        <h3 className="text-xl font-bold">
          {t("Category attribute templates")}
        </h3>
        {categories.map((c) => (
          <form
            key={c.id}
            className="mt-3 grid gap-3 rounded-xl border p-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const template = String(f.get("fields"))
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const [key, label, type, required] = line
                    .split("|")
                    .map((s) => s.trim());
                  return {
                    key,
                    label,
                    type: type || "text",
                    required: required === "required",
                  };
                });
              void call(`/admin/catalog/categories/${c.id}/template`, {
                attributeTemplate: template,
                filterableFields: list(f.get("filters")),
              });
            }}
          >
            <h4 className="font-bold sm:col-span-2">{c.name}</h4>
            <label>
              {t("Attributes: key | label | text/number/boolean | required")}
              <textarea
                name="fields"
                className={input}
                rows={4}
                defaultValue={
                  c.attributeTemplate
                    ?.map(
                      (t) =>
                        `${t.key} | ${t.label} | ${t.type} | ${t.required ? "required" : ""}`,
                    )
                    .join("\n") ?? ""
                }
              />
            </label>
            <label>
              {t("Filterable fields")}
              <input
                name="filters"
                className={input}
                defaultValue={
                  c.filterableFields?.join(", ") ??
                  "category, age, scene, skill, stock, price"
                }
              />
            </label>
            <button className={button} disabled={busy}>
              {t("Save category template")}
            </button>
          </form>
        ))}
      </section>
      <section className="mt-8 rounded-xl border p-5">
        <h3 className="text-xl font-bold">
          {t("Bulk catalog & stock import")}
        </h3>
        <p className="mt-2 text-sm">
          {t(
            "CSV columns: slug, name, sku, msrpCents, available, status, categorySlug, tags. Separate tags with |. Blank category/tags cells clear those values; omit either column to preserve it. Export, edit and upload to review changes before applying them.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <button className={button} onClick={() => void exportCsv()}>
            {t("Export CSV")}
          </button>
          <label>
            {t("Upload CSV")}
            <input
              className={input}
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                setPreview(null);
                setError("");
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2000000) {
                  setError("CSV must be under 2 MB");
                  return;
                }
                try {
                  setRows(parseCsv(await file.text()));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </label>
          <button
            className={button}
            disabled={busy || !rows.length}
            onClick={() =>
              void call(
                "/admin/catalog/import",
                { rows, apply: false },
                "POST",
              ).then((r) => setPreview(r))
            }
          >
            {t("Preview")}
            {rows.length} {t("rows")}
          </button>
        </div>
        {preview && (
          <div className="mt-5">
            <p>
              {preview.creates} {t("new SKUs ·")}
              {preview.updates} {t("updates ·")} {preview.errors.length}{" "}
              {t("errors")}
            </p>
            {preview.errors.map((e) => (
              <p key={e} className="text-red-800">
                {t(String(e))}
              </p>
            ))}
            <div className="mt-3 max-h-72 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>{t("SKU")}</th>
                    <th>{t("Product")}</th>
                    <th>{t("Price (minor units)")}</th>
                    <th>{t("Available")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Category")}</th>
                    <th>{t("Tags")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sku} className="border-t">
                      <td className="py-2">{r.sku}</td>
                      <td>{r.name}</td>
                      <td>{r.msrpCents}</td>
                      <td>{r.available}</td>
                      <td>{t(r.status)}</td>
                      <td>
                        {r.categorySlug === undefined
                          ? t("Keep current")
                          : r.categorySlug || t("Clear category")}
                      </td>
                      <td>
                        {r.tags === undefined
                          ? t("Keep current")
                          : r.tags.join(", ") || t("Clear tags")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className={`${button} mt-4`}
              disabled={busy || !!preview.errors.length || preview.applied}
              onClick={() =>
                void call(
                  "/admin/catalog/import",
                  { rows, apply: true },
                  "POST",
                ).then((r) => setPreview(r))
              }
            >
              {preview.applied ? t("Applied") : t("Apply reviewed import")}
            </button>
          </div>
        )}
      </section>
    </section>
  );
}

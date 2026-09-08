"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { useState, type FormEvent } from "react";
import { ProductSeoFields } from "./product-seo-fields";
import { secureApiFetch } from "../../../lib/secure-api";
export type CategoryData = {
  id: string;
  code: string;
  name: string;
  slug: string;
  parentId: string | null;
  active: boolean;
  sortOrder: number;
  description?: string | null;
  coverImage?: { url: string; alt: string } | null;
  seo?: Record<string, unknown> | null;
};
const field = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
export function CategoryEditor({
  categories,
  mfa,
  onSaved,
}: {
  categories: CategoryData[];
  mfa: string;
  onSaved: () => Promise<void>;
}) {
  const t = useUiText();
  const uiLocale = useUiLocale();

  const [selected, setSelected] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const category = categories.find((c) => c.id === selected);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const coverUrl = String(data.get("coverUrl") ?? "").trim();
      const saved = await secureApiFetch<CategoryData>(
        "staff",
        category
          ? "/admin/catalog/categories/" + category.id
          : "/admin/catalog/categories",
        {
          method: category ? "PATCH" : "POST",
          headers: { "x-mfa-code": mfa },
          body: JSON.stringify({
            code: data.get("code"),
            name: data.get("name"),
            slug: data.get("slug"),
            parentId: data.get("parentId") || null,
            active: data.get("active") === "on",
            sortOrder: Number(data.get("sortOrder")),
            description: data.get("description"),
            coverImage: coverUrl
              ? { url: coverUrl, alt: String(data.get("coverAlt") ?? "") }
              : null,
            seo: {
              ...Object.fromEntries(
                [
                  "title",
                  "description",
                  "ogTitle",
                  "ogDescription",
                  "ogImage",
                  "canonical",
                ].map((key) => [key, String(data.get("seo-" + key) ?? "")]),
              ),
              noindex: data.get("seo-noindex") === "on",
            },
          }),
        },
      );
      await onSaved();
      setSelected(saved.id);
      setMessage(
        "Category saved. Active categories are available in the storefront.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save category",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 rounded-xl border p-5">
      <h3 className="text-xl font-bold">{t("Category pages")}</h3>
      <label className="mt-4 block">
        {t("Edit category")}
        <select
          className={field}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setMessage("");
          }}
        >
          <option value="">{t("Create a new category")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.active ? "" : t(" (hidden)")}
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="mt-3">
        {message ? uiError(uiLocale, message) : ""}
      </p>
      <form
        key={category?.id ?? "new"}
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={save}
      >
        {[
          ["code", "Code", category?.code],
          ["name", "Name", category?.name],
          ["slug", "URL slug", category?.slug],
        ].map(([name, label, value]) => (
          <label key={name}>
            {t(String(label))}
            <input
              required
              maxLength={name === "name" ? 100 : 80}
              name={name}
              defaultValue={value ?? ""}
              className={field}
            />
          </label>
        ))}
        <label>
          {t("Parent category")}
          <select
            name="parentId"
            defaultValue={category?.parentId ?? ""}
            className={field}
          >
            <option value="">{t("Top-level category")}</option>
            {categories
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t("Display order")}
          <input
            type="number"
            name="sortOrder"
            min={0}
            defaultValue={category?.sortOrder ?? 0}
            className={field}
          />
        </label>
        <label className="self-end py-3">
          <input
            name="active"
            type="checkbox"
            defaultChecked={category?.active ?? true}
          />{" "}
          {t("Show category")}
        </label>
        <label className="sm:col-span-2">
          {t("Description")}
          <textarea
            className={field}
            rows={4}
            maxLength={4000}
            name="description"
            defaultValue={category?.description ?? ""}
          />
        </label>
        <label>
          {t("Cover image URL")}
          <input
            name="coverUrl"
            className={field}
            defaultValue={category?.coverImage?.url ?? ""}
          />
        </label>
        <label>
          {t("Cover image description")}
          <input
            name="coverAlt"
            maxLength={400}
            className={field}
            defaultValue={category?.coverImage?.alt ?? ""}
          />
        </label>
        <ProductSeoFields prefix="seo" value={category?.seo ?? {}} />
        <button
          disabled={busy}
          className="rounded-lg border px-5 py-3 font-semibold disabled:opacity-50"
        >
          {busy
            ? t("Saving…")
            : category
              ? t("Save category")
              : t("Create category")}
        </button>
      </form>
    </section>
  );
}

"use client";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { languageName } from "../../../lib/language-code";
import { CmsProductAssociations } from "../../../components/cms-product-associations";
import { CmsBlockOptions } from "../../../components/cms-block-options";
import { RichTextEditor } from "../../../components/rich-text-editor";
import { useEffect, useState } from "react";
import { secureApiFetch } from "../../../lib/secure-api";
type Block = { type: string; props: Record<string, unknown> };
type Translation = {
  status: string;
  title: string;
  sections: Block[];
  seo: Record<string, unknown>;
};
type Page = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  locale: string;
  market: string;
  status: string;
  sections: Block[];
  seo: Record<string, unknown>;
  translations: Record<string, Translation>;
  publishAt: string | null;
  unpublishAt: string | null;
  revision: number;
  author: string;
  category: string;
  productIds: string[];
  sortOrder: number;
};
const blank: Page = {
  id: "",
  slug: "",
  title: "",
  kind: "PAGE",
  locale: "en",
  market: "ALL",
  status: "DRAFT",
  sections: [],
  seo: {},
  translations: {},
  publishAt: null,
  unpublishAt: null,
  revision: 1,
  author: "",
  category: "",
  productIds: [],
  sortOrder: 0,
};
const kinds = [
  "hero",
  "text",
  "heading",
  "list",
  "image",
  "video",
  "quote",
  "cta",
  "products",
  "categories",
  "articles",
  "faq",
  "download",
  "newsletter",
  "values",
];
const normalize = (blocks: unknown): Block[] =>
  Array.isArray(blocks)
    ? blocks.map((b) =>
        typeof b === "string"
          ? { type: "text", props: { text: b } }
          : {
              type: b.type ?? "text",
              props:
                b.props ??
                Object.fromEntries(
                  Object.entries(b).filter(([key]) => key !== "type"),
                ),
            },
      )
    : [];
const field =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2";
export function CmsWorkbench() {
  const [languages, setLanguages] = useState<string[]>(["en", "zh"]);
  useEffect(() => {
    void apiFetch<{ locale: { languages: string[] } }>("/site/config")
      .then((config) => setLanguages(config.locale.languages))
      .catch(() => undefined);
  }, []);
  const [pages, setPages] = useState<Page[]>([]),
    [page, setPage] = useState<Page>(blank),
    [locale, setLocale] = useState("en"),
    [mfa, setMfa] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [versions, setVersions] = useState<
      Array<{ revision: number; createdAt: string }>
    >([]),
    [drag, setDrag] = useState<number | null>(null);
  async function load() {
    try {
      setPages(await secureApiFetch<Page[]>("staff", "/admin/cms/pages"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load content");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const availableLanguages = [
    ...new Set([
      ...languages,
      page.locale,
      ...Object.keys(page.translations ?? {}),
    ]),
  ];
  const translated = locale !== page.locale;
  const version = page.translations?.[locale] ?? {
    status: "IN_PROGRESS",
    title: "",
    sections: [],
    seo: {},
  };
  const title = translated ? version.title : page.title,
    blocks = normalize(translated ? version.sections : page.sections),
    seo = translated ? version.seo : page.seo;
  function content(patch: Partial<Translation>) {
    setPage((p) =>
      translated
        ? {
            ...p,
            translations: {
              ...p.translations,
              [locale]: { ...version, ...patch },
            },
          }
        : { ...p, ...patch },
    );
  }
  function block(index: number, patch: Record<string, unknown>) {
    content({
      sections: blocks.map((b, i) =>
        i === index ? { ...b, props: { ...b.props, ...patch } } : b,
      ),
    });
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    content({ sections: next });
  }
  function select(p: Page) {
    setPage({
      ...p,
      productIds: p.productIds ?? [],
      sortOrder: p.sortOrder ?? 0,
      sections: normalize(p.sections),
      seo: p.seo ?? {},
      translations: p.translations ?? {},
    });
    setLocale(p.locale);
    setVersions([]);
    setMessage("");
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const { id, revision } = page;
      const data = Object.fromEntries(
        [
          "slug",
          "title",
          "kind",
          "locale",
          "market",
          "status",
          "sections",
          "seo",
          "translations",
          "publishAt",
          "unpublishAt",
          "author",
          "category",
          "productIds",
          "sortOrder",
        ].map((key) => [key, page[key as keyof Page]]),
      );
      const body = {
        ...data,
        expectedRevision: revision,
        sections: normalize(page.sections),
      };
      const saved = await secureApiFetch<Page>(
        "staff",
        id ? `/cms/pages/${id}` : "/cms/pages",
        {
          method: id ? "PATCH" : "POST",
          headers: { "x-mfa-code": mfa },
          body: JSON.stringify(body),
        },
      );
      select(saved);
      setMessage(
        "Content saved. Published changes are visible on the website.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-7xl px-4 py-10"
    >
      <Link className="underline" href="/admin/dashboard">
        Operations dashboard
      </Link>
      <h1 className="my-5 text-3xl font-bold">Content studio</h1>
      <p className="mb-6 text-neutral-600">
        Build pages with content blocks, schedule publishing, and manage
        complete translations.
      </p>
      <p role="status" className="mb-4">
        {message}
      </p>
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside>
          <button
            onClick={() => select({ ...blank })}
            className="mb-4 w-full rounded-lg border p-3 font-semibold"
          >
            New page
          </button>
          <ul className="space-y-2">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => select(p)}
                  className={`w-full rounded-lg border p-3 text-left ${p.id === page.id ? "bg-sky-50" : ""}`}
                >
                  <strong>{p.title}</strong>
                  <small className="block">
                    {p.slug} · {p.status}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="min-w-0">
          <div className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
            <label>
              Slug
              <input
                value={page.slug}
                onChange={(e) => setPage({ ...page, slug: e.target.value })}
                className={field}
              />
            </label>
            <label>
              Content type
              <select
                value={page.kind}
                onChange={(e) => setPage({ ...page, kind: e.target.value })}
                className={field}
              >
                {["PAGE", "HOME", "ARTICLE", "FAQ", "BANNER", "NAVIGATION"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Base language
              <select
                value={page.locale}
                onChange={(e) => {
                  setPage({ ...page, locale: e.target.value });
                  setLocale(e.target.value);
                }}
                className={field}
              >
                {availableLanguages.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Market (ALL or market code)
              <input
                value={page.market}
                onChange={(e) =>
                  setPage({ ...page, market: e.target.value.toUpperCase() })
                }
                className={field}
              />
            </label>
            <label>
              Author
              <input
                value={page.author ?? ""}
                onChange={(e) => setPage({ ...page, author: e.target.value })}
                className={field}
              />
            </label>
            <label>
              Category
              <input
                value={page.category ?? ""}
                onChange={(e) => setPage({ ...page, category: e.target.value })}
                className={field}
              />
            </label>
            <label>
              Display order (smaller first)
              <input
                type="number"
                min={0}
                max={1000000}
                value={page.sortOrder}
                onChange={(e) =>
                  setPage({ ...page, sortOrder: Number(e.target.value) })
                }
                className={field}
              />
            </label>
            <CmsProductAssociations
              ids={page.productIds}
              onChange={(productIds) => setPage({ ...page, productIds })}
            />
            <label>
              Publish state
              <select
                value={page.status}
                onChange={(e) => setPage({ ...page, status: e.target.value })}
                className={field}
              >
                {["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Edit language
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className={field}
              >
                {availableLanguages.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </label>
            {translated && (
              <label>
                Translation status
                <select
                  value={version.status}
                  onChange={(e) => content({ status: e.target.value })}
                  className={field}
                >
                  {["NOT_STARTED", "IN_PROGRESS", "READY", "PUBLISHED"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
            )}
            <label>
              Publish at (UTC)
              <input
                type="datetime-local"
                value={page.publishAt?.slice(0, 16) ?? ""}
                onChange={(e) =>
                  setPage({
                    ...page,
                    publishAt: e.target.value
                      ? new Date(e.target.value + "Z").toISOString()
                      : null,
                  })
                }
                className={field}
              />
            </label>
            <label>
              Unpublish at (UTC)
              <input
                type="datetime-local"
                value={page.unpublishAt?.slice(0, 16) ?? ""}
                onChange={(e) =>
                  setPage({
                    ...page,
                    unpublishAt: e.target.value
                      ? new Date(e.target.value + "Z").toISOString()
                      : null,
                  })
                }
                className={field}
              />
            </label>
            <label className="sm:col-span-2">
              Page title
              <input
                value={title}
                onChange={(e) => content({ title: e.target.value })}
                className={field}
              />
            </label>
          </div>
          <div className="mt-6 space-y-4">
            {blocks.map((b, index) => (
              <article
                key={index}
                draggable
                onDragStart={() => setDrag(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag !== null) move(drag, index);
                  setDrag(null);
                }}
                className="rounded-xl border bg-neutral-50 p-5"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <strong>
                    {index + 1}. {b.type}
                  </strong>
                  <button
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    className="rounded border px-2"
                    aria-label={`Move block ${index + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(index, index + 1)}
                    disabled={index === blocks.length - 1}
                    className="rounded border px-2"
                    aria-label={`Move block ${index + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() =>
                      content({
                        sections: blocks.filter((_, i) => i !== index),
                      })
                    }
                    className="ml-auto underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CmsBlockOptions
                    type={b.type}
                    value={b.props}
                    onChange={(patch) => block(index, patch)}
                    articles={pages.filter(
                      (p) => p.kind === "ARTICLE" && p.id !== page.id,
                    )}
                    announcement={page.kind === "BANNER" && index === 0}
                  />
                  {[
                    "title",
                    "text",
                    "href",
                    "label",
                    ...(["hero", "image", "video"].includes(b.type)
                      ? ["image", "mobileImage", "src", "alt", "poster"]
                      : []),
                    ...(["products", "articles"].includes(b.type)
                      ? ["category"]
                      : []),
                    ...(b.type === "products" ? ["tag"] : []),
                  ].map((key) => (
                    <label
                      key={key}
                      className={key === "text" ? "sm:col-span-2" : ""}
                    >
                      {(
                        {
                          text: "Body text",
                          href: "Link",
                          label: "Button label",
                          image: "Desktop image URL",
                          mobileImage: "Mobile image URL",
                          src: "Image or video URL",
                          alt: "Image description",
                          poster: "Video poster URL",
                        } as Record<string, string>
                      )[key] ?? key}
                      {key === "text" ? (
                        <RichTextEditor
                          value={String(b.props[key] ?? "")}
                          onChange={(value) => block(index, { [key]: value })}
                        />
                      ) : (
                        <input
                          value={String(b.props[key] ?? "")}
                          onChange={(e) =>
                            block(index, { [key]: e.target.value })
                          }
                          className={field}
                        />
                      )}
                    </label>
                  ))}
                  {b.type === "products" && (
                    <>
                      <label>
                        Selection rule
                        <select
                          value={String(b.props.sort ?? "featured")}
                          onChange={(e) =>
                            block(index, { sort: e.target.value })
                          }
                          className={field}
                        >
                          <option value="featured">Featured</option>
                          <option value="newest">Newest</option>
                        </select>
                      </label>
                      <label>
                        Selected product IDs (comma separated)
                        <input
                          value={(Array.isArray(b.props.productIds)
                            ? b.props.productIds
                            : []
                          ).join(",")}
                          onChange={(e) =>
                            block(index, {
                              productIds: e.target.value
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                          className={field}
                        />
                      </label>
                    </>
                  )}
                  {["products", "articles", "categories"].includes(b.type) && (
                    <label>
                      Number of cards
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={Number(b.props.limit ?? 8)}
                        onChange={(e) =>
                          block(index, { limit: Number(e.target.value) })
                        }
                        className={field}
                      />
                    </label>
                  )}
                  {["list", "values"].includes(b.type) && (
                    <label className="sm:col-span-2">
                      List items (one per line)
                      <textarea
                        value={(Array.isArray(b.props.items)
                          ? b.props.items
                          : []
                        )
                          .map((v) =>
                            typeof v === "string" ? v : String(v.title ?? ""),
                          )
                          .join("\n")}
                        onChange={(e) =>
                          block(index, {
                            items: e.target.value.split("\n").filter(Boolean),
                          })
                        }
                        className={field}
                      />
                    </label>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="my-5 flex flex-wrap gap-2">
            {kinds.map((type) => (
              <button
                key={type}
                onClick={() =>
                  content({ sections: [...blocks, { type, props: {} }] })
                }
                className="rounded-lg border px-3 py-2"
              >
                + {type}
              </button>
            ))}
          </div>
          <details className="rounded-xl border p-5">
            <summary className="font-semibold">SEO and social sharing</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "title",
                "description",
                "ogTitle",
                "ogDescription",
                "ogImage",
                "canonical",
              ].map((key) => (
                <label key={key}>
                  {key}
                  <input
                    value={String(seo?.[key] ?? "")}
                    onChange={(e) =>
                      content({ seo: { ...seo, [key]: e.target.value } })
                    }
                    className={field}
                  />
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={seo?.noindex === true}
                  onChange={(e) =>
                    content({ seo: { ...seo, noindex: e.target.checked } })
                  }
                />{" "}
                Exclude from search engines
              </label>
            </div>
          </details>
          <div className="sticky bottom-0 mt-5 flex flex-wrap gap-3 rounded-xl border bg-white p-4">
            <label>
              MFA code
              <input
                value={mfa}
                onChange={(e) => setMfa(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                className="ml-2 w-28 rounded border p-2"
              />
            </label>
            <button
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-[#245f7e] px-5 py-2 font-semibold text-white"
            >
              Save content
            </button>
            {page.id && (
              <>
                <Link
                  target="_blank"
                  className="rounded-lg border px-4 py-2"
                  href={`/admin/cms/preview?id=${page.id}`}
                >
                  Preview
                </Link>
                <button
                  onClick={async () => {
                    try {
                      setVersions(
                        await secureApiFetch(
                          "staff",
                          `/admin/cms/pages/${page.id}/versions`,
                        ),
                      );
                    } catch (e) {
                      setMessage(String(e));
                    }
                  }}
                  className="rounded-lg border px-4 py-2"
                >
                  Version history
                </button>
              </>
            )}
          </div>
          {versions.length > 0 && (
            <ul className="mt-4 space-y-3">
              {versions.map((v) => (
                <li
                  key={v.revision}
                  className="flex gap-5 rounded-lg border p-3"
                >
                  Version {v.revision} ·{" "}
                  {new Date(v.createdAt).toLocaleString()}
                  <button
                    className="underline"
                    onClick={async () => {
                      try {
                        select(
                          await secureApiFetch(
                            "staff",
                            `/admin/cms/pages/${page.id}/restore/${v.revision}`,
                            {
                              method: "POST",
                              headers: { "x-mfa-code": mfa },
                              body: "{}",
                            },
                          ),
                        );
                        await load();
                        setMessage("Version restored as draft.");
                      } catch (e) {
                        setMessage(String(e));
                      }
                    }}
                  >
                    Restore as draft
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

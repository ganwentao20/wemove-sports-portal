"use client";
import { useState } from "react";
import { ProductSeoFields } from "./product-seo-fields";
type Translation = {
  seo?: Record<string, unknown>;
  status?: string;
  name?: string;
  summary?: string;
  description?: string;
  ageGuidance?: string;
  playGuide?: string;
  specifications?: Record<
    string,
    { label: string; value: string | number | boolean }
  >;
  productFaq?: Array<{ question: string; answer: string }>;
};
type Source = {
  specifications: Record<string, unknown>;
  productFaq: Array<{ question: string; answer: string }>;
};
const input = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
const button = "rounded-lg border px-4 py-2 text-sm font-semibold";
export function ProductTranslations({ source }: { source: Source }) {
  const [translations, setTranslations] = useState<Record<string, Translation>>(
    (source.specifications.translations ?? {}) as Record<string, Translation>,
  );
  const [language, setLanguage] = useState("zh");
  const [error, setError] = useState("");
  const specifications = Object.entries(source.specifications).filter(
    ([key, value]) =>
      key !== "translations" &&
      key !== "reviews" &&
      ["string", "number", "boolean"].includes(typeof value),
  );
  function update(locale: string, values: Partial<Translation>) {
    setTranslations((current) => ({
      ...current,
      [locale]: { ...current[locale], ...values },
    }));
  }
  return (
    <section className="sm:col-span-2 lg:col-span-3">
      <h3 className="text-lg font-bold">Product translations</h3>
      <p className="mt-2 text-sm text-neutral-600">
        Publish a complete translation of the name, summary, source
        descriptions, specifications and FAQ. Save source specification or FAQ
        changes before updating their translations. Enable the language in site
        settings when it is ready for visitors.
      </p>
      <input
        type="hidden"
        name="translations"
        value={JSON.stringify(translations)}
      />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label>
          Language code
          <input
            className={input}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="zh, fr, de, zh-CN"
          />
        </label>
        <button
          className={button}
          type="button"
          onClick={() => {
            if (
              !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language) ||
              language === "en"
            ) {
              setError(
                "Enter a language code such as zh, fr, de or zh-CN. Edit English in the source fields.",
              );
              return;
            }
            if (translations[language]) {
              setError("This language is already listed below.");
              return;
            }
            setError("");
            update(language, { status: "NOT_STARTED" });
          }}
        >
          Add translation
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-red-800">
          {error}
        </p>
      )}
      {Object.entries(translations).map(([locale, t]) => (
        <fieldset
          key={locale}
          className="mt-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <legend className="px-2 font-bold">{locale}</legend>
          <label>
            Publication status
            <select
              className={input}
              value={
                t.status === "DRAFT"
                  ? "IN_PROGRESS"
                  : (t.status ?? "NOT_STARTED")
              }
              onChange={(event) =>
                update(locale, { status: event.target.value })
              }
            >
              <option value="NOT_STARTED">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="READY">Ready for publication</option>
              <option value="PUBLISHED">Publish complete translation</option>
            </select>
          </label>
          {(
            [
              "name",
              "summary",
              "description",
              "ageGuidance",
              "playGuide",
            ] as const
          ).map((key, index) => (
            <label key={key}>
              {
                [
                  "Name",
                  "Summary",
                  "Description",
                  "Age and safety guidance",
                  "Play guide",
                ][index]
              }
              <textarea
                className={input}
                value={t[key] ?? ""}
                rows={key === "description" || key === "playGuide" ? 4 : 2}
                onChange={(event) =>
                  update(locale, { [key]: event.target.value })
                }
              />
            </label>
          ))}
          {specifications.map(([key, value]) => (
            <div key={key} className="rounded-lg border p-3">
              <p className="text-sm text-neutral-600">
                Source: {key} = {String(value)}
              </p>
              <label>
                Translated label
                <input
                  className={input}
                  value={t.specifications?.[key]?.label ?? ""}
                  onChange={(event) =>
                    update(locale, {
                      specifications: {
                        ...t.specifications,
                        [key]: {
                          label: event.target.value,
                          value: t.specifications?.[key]?.value ?? "",
                        },
                      },
                    })
                  }
                />
              </label>
              <label>
                Translated value
                <input
                  className={input}
                  value={String(t.specifications?.[key]?.value ?? "")}
                  onChange={(event) =>
                    update(locale, {
                      specifications: {
                        ...t.specifications,
                        [key]: {
                          label: t.specifications?.[key]?.label ?? "",
                          value:
                            typeof value === "number"
                              ? Number(event.target.value)
                              : typeof value === "boolean"
                                ? event.target.value === "true"
                                : event.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
          ))}
          {source.productFaq.map((faq, index) => (
            <div key={index} className="rounded-lg border p-3">
              <p className="text-sm text-neutral-600">
                Source FAQ: {faq.question} — {faq.answer}
              </p>
              {(["question", "answer"] as const).map((key) => (
                <label key={key}>
                  {key === "question"
                    ? "Translated question"
                    : "Translated answer"}
                  <textarea
                    className={input}
                    value={t.productFaq?.[index]?.[key] ?? ""}
                    onChange={(event) =>
                      update(locale, {
                        productFaq: source.productFaq.map((_, i) => ({
                          ...{ question: "", answer: "" },
                          ...t.productFaq?.[i],
                          ...(i === index ? { [key]: event.target.value } : {}),
                        })),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          ))}
          <ProductSeoFields
            value={t.seo ?? {}}
            onChange={(seo) => update(locale, { seo })}
          />
          <button
            type="button"
            className={`${button} self-end`}
            onClick={() =>
              setTranslations((current) =>
                Object.fromEntries(
                  Object.entries(current).filter(([key]) => key !== locale),
                ),
              )
            }
          >
            Remove {locale} translation
          </button>
        </fieldset>
      ))}
    </section>
  );
}

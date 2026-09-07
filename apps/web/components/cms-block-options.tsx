"use client";
type Props = {
  type: string;
  value: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  articles: Array<{ id: string; title: string }>;
  announcement: boolean;
};
export function CmsBlockOptions({
  type,
  value,
  onChange,
  articles,
  announcement,
}: Props) {
  const field =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2";
  const chosen = Array.isArray(value.articleIds)
    ? (value.articleIds as string[])
    : [];
  return (
    <>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled !== false}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        Module enabled
      </label>
      {(["publishAt", "unpublishAt"] as const).map((key) => (
        <label key={key}>
          {key === "publishAt"
            ? "Module starts at (UTC)"
            : "Module ends at (UTC)"}
          <input
            type="datetime-local"
            className={field}
            value={
              typeof value[key] === "string"
                ? String(value[key]).slice(0, 16)
                : ""
            }
            onChange={(e) =>
              onChange({
                [key]: e.target.value
                  ? new Date(e.target.value + "Z").toISOString()
                  : null,
              })
            }
          />
        </label>
      ))}
      {announcement && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.dismissible !== false}
            onChange={(e) => onChange({ dismissible: e.target.checked })}
          />
          Visitors may dismiss this announcement
        </label>
      )}
      {type === "hero" && (
        <>
          <label>
            Text alignment
            <select
              className={field}
              value={String(value.align ?? "left")}
              onChange={(e) => onChange({ align: e.target.value })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label>
            Second button label
            <input
              className={field}
              value={String(value.secondaryLabel ?? "")}
              onChange={(e) => onChange({ secondaryLabel: e.target.value })}
            />
          </label>
          <label>
            Second button URL
            <input
              className={field}
              value={String(value.secondaryHref ?? "")}
              onChange={(e) => onChange({ secondaryHref: e.target.value })}
            />
          </label>
        </>
      )}
      {type === "articles" && (
        <section className="sm:col-span-2">
          <label>
            Manually selected articles (up to 24; blank uses the category rule)
            <select
              multiple
              size={Math.min(6, Math.max(2, articles.length))}
              className={field}
              value={chosen}
              onChange={(e) =>
                onChange({
                  articleIds: Array.from(e.target.selectedOptions)
                    .map((option) => option.value)
                    .slice(0, 24),
                })
              }
            >
              {articles.map((article) => (
                <option value={article.id} key={article.id}>
                  {article.title}
                </option>
              ))}
            </select>
          </label>
          {chosen.length > 0 && (
            <ol className="mt-3 space-y-2">
              {chosen.map((id, index) => (
                <li key={id} className="flex items-center gap-3">
                  <span>
                    {articles.find((article) => article.id === id)?.title ?? id}
                  </span>
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move selected article ${index + 1} up`}
                    className="rounded border px-3 py-1"
                    onClick={() => {
                      const next = [...chosen];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      onChange({ articleIds: next });
                    }}
                  >
                    ↑
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

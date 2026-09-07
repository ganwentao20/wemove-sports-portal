"use client";
import type { NavigationItem } from "../lib/navigation";
export function NavigationSettings({
  items,
  languages,
  onChange,
}: {
  items: NavigationItem[];
  languages: string[];
  onChange: (items: NavigationItem[]) => void;
}) {
  const field = "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2";
  function editor(
    item: NavigationItem,
    update: (item: NavigationItem) => void,
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          English label
          <input
            className={field}
            value={item.label}
            onChange={(e) => update({ ...item, label: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Local URL
          <input
            className={field}
            value={item.href}
            onChange={(e) => update({ ...item, href: e.target.value })}
          />
        </label>
        {languages
          .filter((l) => l !== "en")
          .map((language) => (
            <label className="text-sm" key={language}>
              {language} label
              <input
                className={field}
                value={
                  item.labels?.[language] ??
                  (language === "zh" ? item.zh : "") ??
                  ""
                }
                onChange={(e) =>
                  update({
                    ...item,
                    labels: { ...item.labels, [language]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        <label className="text-sm">
          Markets (comma separated; blank = all)
          <input
            className={field}
            value={(item.markets ?? []).join(",")}
            onChange={(e) =>
              update({
                ...item,
                markets: e.target.value
                  .split(",")
                  .map((v) => v.trim().toUpperCase())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <section key={index} className="rounded-xl border p-4">
          {editor(item, (value) =>
            onChange(items.map((row, i) => (i === index ? value : row))),
          )}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className="rounded border px-3 py-2"
              aria-label={`Move navigation ${index + 1} up`}
              disabled={index === 0}
              onClick={() => {
                const next = [...items];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Remove link
            </button>
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={() =>
                onChange(
                  items.map((row, i) =>
                    i === index
                      ? {
                          ...row,
                          children: [
                            ...(row.children ?? []),
                            { label: "", href: "/" },
                          ],
                        }
                      : row,
                  ),
                )
              }
            >
              Add secondary link
            </button>
          </div>
          {item.children?.map((child, childIndex) => (
            <div
              key={childIndex}
              className="ml-4 mt-4 rounded-lg border-l-4 border-neutral-300 p-3"
            >
              {editor(child, (value) =>
                onChange(
                  items.map((row, i) =>
                    i === index
                      ? {
                          ...row,
                          children: row.children?.map((c, j) =>
                            j === childIndex ? value : c,
                          ),
                        }
                      : row,
                  ),
                ),
              )}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={childIndex === 0}
                  className="rounded border px-3 py-2"
                  aria-label={`Move secondary navigation ${childIndex + 1} up`}
                  onClick={() => {
                    const children = [...(item.children ?? [])];
                    [children[childIndex - 1], children[childIndex]] = [
                      children[childIndex],
                      children[childIndex - 1],
                    ];
                    onChange(
                      items.map((row, i) =>
                        i === index ? { ...row, children } : row,
                      ),
                    );
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-2"
                  onClick={() =>
                    onChange(
                      items.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              children: row.children?.filter(
                                (_, j) => j !== childIndex,
                              ),
                            }
                          : row,
                      ),
                    )
                  }
                >
                  Remove secondary link
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { label: "", href: "/" }])}
        className="rounded border px-4 py-2"
      >
        Add primary link
      </button>
    </div>
  );
}

"use client";
export function ProductSeoFields({
  value,
  prefix,
  onChange,
}: {
  value: Record<string, unknown>;
  prefix?: string;
  onChange?: (value: Record<string, unknown>) => void;
}) {
  const field = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
  return (
    <details className="rounded-xl border p-4 sm:col-span-2 lg:col-span-3">
      <summary className="cursor-pointer font-bold">
        Search and social metadata
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          "title",
          "description",
          "ogTitle",
          "ogDescription",
          "ogImage",
          "canonical",
        ].map((key) => (
          <label key={key}>
            {
              (
                {
                  title: "Search title",
                  description: "Search description",
                  ogTitle: "Social title",
                  ogDescription: "Social description",
                  ogImage: "Social image URL",
                  canonical: "Canonical URL",
                } as Record<string, string>
              )[key]
            }
            <input
              className={field}
              name={prefix ? `${prefix}-${key}` : undefined}
              {...(onChange
                ? {
                    value: String(value[key] ?? ""),
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      onChange({ ...value, [key]: event.target.value }),
                  }
                : { defaultValue: String(value[key] ?? "") })}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            name={prefix ? `${prefix}-noindex` : undefined}
            {...(onChange
              ? {
                  checked: value.noindex === true,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({ ...value, noindex: event.target.checked }),
                }
              : { defaultChecked: value.noindex === true })}
          />
          Exclude this language page from search engines
        </label>
      </div>
    </details>
  );
}

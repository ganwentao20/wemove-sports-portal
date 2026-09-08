"use client";
import { useUiText } from "./ui-locale";
type Social = { label: string; href: string };
export function BrandSocialLinks({
  value,
  onChange,
}: {
  value: Social[];
  onChange: (links: Social[]) => void;
}) {
  const t = useUiText();
  function update(index: number, patch: Partial<Social>) {
    onChange(
      value.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  return (
    <fieldset className="mb-5 rounded-lg border p-4">
      <legend className="px-2 font-semibold">{t("Social profiles")}</legend>
      <p className="mb-3 text-sm text-neutral-700">
        {t(
          "Public footer links, in display order. Use the complete HTTPS profile URL.",
        )}
      </p>
      <div className="space-y-3">
        {value.map((item, index) => (
          <div
            key={index}
            className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]"
          >
            <label>
              {t("Profile label")}
              <input
                required
                maxLength={80}
                value={item.label}
                onChange={(e) => update(index, { label: e.target.value })}
                className="mt-1 block w-full rounded border p-2"
              />
            </label>
            <label>
              {t("HTTPS URL")}
              <input
                required
                type="url"
                pattern="https://.*"
                maxLength={2048}
                value={item.href}
                onChange={(e) => update(index, { href: e.target.value })}
                className="mt-1 block w-full rounded border p-2"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={index === 0}
                aria-label={t("Move social profile {number} up", {
                  number: index + 1,
                })}
                className="rounded border p-2"
                onClick={() => {
                  const next = [...value];
                  [next[index - 1], next[index]] = [
                    next[index],
                    next[index - 1],
                  ];
                  onChange(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded border p-2"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                {t("Remove")}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={value.length >= 20}
        onClick={() => onChange([...value, { label: "", href: "" }])}
        className="mt-3 rounded border px-4 py-2"
      >
        {t("Add social profile")}
      </button>
    </fieldset>
  );
}

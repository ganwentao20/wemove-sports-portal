"use client";
import { useEffect, useState } from "react";
type Policy = {
  languages: string[];
  defaultLanguage: string;
  fallback: string;
};
export function LocaleSettings({
  value,
  onSave,
  busy,
}: {
  value: Policy;
  onSave: (value: Policy) => void;
  busy: boolean;
}) {
  const [extra, setExtra] = useState(""),
    [chinese, setChinese] = useState(false),
    [fallback, setFallback] = useState("DEFAULT");
  useEffect(() => {
    setExtra(
      (value.languages ?? [])
        .filter((code) => !["en", "zh"].includes(code))
        .join(", "),
    );
    setChinese(value.languages?.includes("zh") ?? false);
    setFallback(value.fallback ?? "DEFAULT");
  }, [value]);
  return (
    <form
      className="rounded-xl border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          defaultLanguage: "en",
          languages: [
            ...new Set([
              "en",
              ...(chinese ? ["zh"] : []),
              ...extra.split(/[,\s]+/).filter(Boolean),
            ]),
          ],
          fallback,
        });
      }}
    >
      <h2 className="mb-3 text-xl font-bold">Languages</h2>
      <p className="mb-3 text-sm text-neutral-700">
        English is the default. Publish complete content translations before
        enabling another language.
      </p>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={chinese}
          onChange={(e) => setChinese(e.target.checked)}
        />
        Enable Chinese
      </label>
      <label className="mt-4 block">
        Additional language codes (comma separated)
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="fr, de, pt-BR"
          className="mt-1 block w-full rounded border p-2"
        />
      </label>
      <p className="mt-2 text-sm text-neutral-700">
        Use two or three lowercase letters, optionally followed by a region such
        as pt-BR. Account and checkout templates currently use English.
      </p>
      <label className="mt-4 block">
        Incomplete translations
        <select
          value={fallback}
          onChange={(e) => setFallback(e.target.value)}
          className="mt-1 block w-full rounded border p-2"
        >
          <option value="DEFAULT">Show the complete English page</option>
          <option value="HIDE">Do not publish that language version</option>
        </select>
      </label>
      <button disabled={busy} className="mt-3 rounded border px-4 py-2">
        Save languages
      </button>
    </form>
  );
}

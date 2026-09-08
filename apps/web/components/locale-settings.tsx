"use client";
import { useUiText } from "./ui-locale";

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
  const t = useUiText();

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
      <h2 className="mb-3 text-xl font-bold">{t("Languages")}</h2>
      <p className="mb-3 text-sm text-neutral-700">
        {t(
          "The interface supports English and Chinese. These settings control published content languages; publish complete translations before enabling them.",
        )}
      </p>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={chinese}
          onChange={(e) => setChinese(e.target.checked)}
        />
        {t("Enable Chinese content")}
      </label>
      <label className="mt-4 block">
        {t("Additional language codes (comma separated)")}
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder={t("fr, de, pt-BR")}
          className="mt-1 block w-full rounded border p-2"
        />
      </label>
      <p className="mt-2 text-sm text-neutral-700">
        {t(
          "Use two or three lowercase letters, optionally followed by a region such as pt-BR. Account and checkout interfaces support English and Chinese.",
        )}
      </p>
      <label className="mt-4 block">
        {t("Incomplete translations")}
        <select
          value={fallback}
          onChange={(e) => setFallback(e.target.value)}
          className="mt-1 block w-full rounded border p-2"
        >
          <option value="DEFAULT">{t("Show published English content")}</option>
          <option value="HIDE">
            {t("Do not publish that language version")}
          </option>
        </select>
      </label>
      <button disabled={busy} className="mt-3 rounded border px-4 py-2">
        {t("Save languages")}
      </button>
    </form>
  );
}

"use client";
import { LANGUAGE_PREFIX, languageName } from "../lib/language-code";
import { usePathname } from "next/navigation";
import { useId } from "react";
export function SitePreferences({
  locale,
  market,
  markets,
  languages = ["en", "zh"],
}: {
  languages?: string[];
  locale: string;
  market: string;
  markets: Array<{ code: string; label: string; currency: string }>;
}) {
  const id = useId(),
    path = usePathname().replace(LANGUAGE_PREFIX, "") || "/",
    zh = locale === "zh";
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={id + "-language"}>
        {zh ? "语言" : "Language"}
      </label>
      <select
        id={id + "-language"}
        value={locale}
        onChange={(event) => {
          location.assign(
            "/" +
              event.target.value +
              (path === "/" ? "" : path) +
              location.search,
          );
        }}
        className="max-w-24 rounded-lg border px-2 py-1"
      >
        {languages.map((code) => (
          <option key={code} value={code}>
            {languageName(code)}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={id + "-market"}>
        {zh ? "市场" : "Market"}
      </label>
      <select
        id={id + "-market"}
        value={market}
        onChange={(event) => {
          document.cookie =
            "wm_market=" +
            encodeURIComponent(event.target.value) +
            ";path=/;max-age=31536000;SameSite=Lax";
          const url = new URL(location.href);
          url.searchParams.set("market", event.target.value);
          location.assign(url.toString());
        }}
        className="max-w-32 rounded-lg border px-2 py-1"
      >
        {markets.map((m) => (
          <option key={m.code} value={m.code}>
            {zh ? m.code : m.label} · {m.currency}
          </option>
        ))}
      </select>
    </div>
  );
}

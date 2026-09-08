"use client";
import { languageName } from "../lib/language-code";
import { selectLanguage } from "../lib/language-switch";
import { useHydrated } from "../lib/use-hydrated";
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
  const hydrated = useHydrated();
  const id = useId(),
    zh = locale.startsWith("zh");
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={id + "-language"}>
        {zh ? "语言" : "Language"}
      </label>
      <select
        id={id + "-language"}
        disabled={!hydrated}
        value={locale}
        onChange={(event) => selectLanguage(event.target.value)}
        className="max-w-24 rounded-lg border px-2 py-1"
      >
        {Array.from(new Set(["en", "zh", ...languages])).map((code) => (
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
        disabled={!hydrated}
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
            {zh
              ? ((
                  {
                    US: "美国",
                    CN: "中国",
                    GB: "英国",
                    EU: "欧盟",
                    CA: "加拿大",
                    AU: "澳大利亚",
                  } as Record<string, string>
                )[m.code] ?? m.label)
              : m.label}{" "}
            · {m.currency}
          </option>
        ))}
      </select>
    </div>
  );
}

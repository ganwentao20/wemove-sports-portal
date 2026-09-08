"use client";
import { useId } from "react";
import { usePathname } from "next/navigation";
import { LANGUAGE_PREFIX, languageName } from "../lib/language-code";
import { selectLanguage } from "../lib/language-switch";
import { useUiLocale, useUiText } from "./ui-locale";
import { useHydrated } from "../lib/use-hydrated";

export function LanguagePicker({
  locale: selectedLocale,
}: {
  locale?: string;
}) {
  const hydrated = useHydrated();
  const contextLocale = useUiLocale();
  const locale = selectedLocale ?? contextLocale;
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
      <span>{locale.startsWith("zh") ? "语言" : "Language"}</span>
      <select
        id={id}
        value={locale}
        disabled={!hydrated}
        onChange={(event) => selectLanguage(event.target.value)}
        className="rounded-lg border bg-white px-3 py-2 text-slate-900"
      >
        {["en", "zh"].map((code) => (
          <option value={code} key={code}>
            {languageName(code)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PortalLanguageBar() {
  const path = usePathname().replace(LANGUAGE_PREFIX, "") || "/";
  const locale = useUiLocale();
  const t = useUiText();
  if (!/^\/(admin|customer|dealer|login)(\/|$)/.test(path)) return null;
  return (
    <nav
      aria-label={t("Language")}
      className="flex items-center justify-between gap-4 border-b bg-white px-6 py-3"
    >
      <a href={`/${locale}`} className="text-sm font-semibold">
        WEMOVE · {t("Home")}
      </a>
      <LanguagePicker />
    </nav>
  );
}

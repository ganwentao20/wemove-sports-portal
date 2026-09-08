import { LANGUAGE_PREFIX } from "./language-code";

/** Explicit selection wins over the remembered language; retain filters and anchors. */
export function languageUrl(href: string, locale: string): string {
  const url = new URL(href, "http://local.invalid");
  const path = url.pathname.replace(LANGUAGE_PREFIX, "") || "/";
  url.pathname = `/${locale}${path === "/" ? "" : path}`;
  // Login return targets must not send the visitor back to the old language.
  for (const key of ["next", "returnTo"]) {
    const target = url.searchParams.get(key);
    if (target?.startsWith("/") && !target.startsWith("//")) {
      const parsed = new URL(target, url.origin);
      const nextPath = parsed.pathname.replace(LANGUAGE_PREFIX, "") || "/";
      url.searchParams.set(
        key,
        `/${locale}${nextPath === "/" ? "" : nextPath}${parsed.search}${parsed.hash}`,
      );
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function selectLanguage(locale: string) {
  document.cookie = `wm_locale=${encodeURIComponent(locale)};path=/;max-age=31536000;SameSite=Lax`;
  window.location.assign(languageUrl(window.location.href, locale));
}

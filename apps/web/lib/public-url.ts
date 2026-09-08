import { LANGUAGE_PREFIX } from "./language-code";
export function publicUrl(path: string, locale: string, market: string) {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /^\/(api|_next|uploads)(\/|$)/.test(path)
  )
    return path;
  const url = new URL(path, "https://local.invalid");
  url.searchParams.set("market", market);
  const prefix = LANGUAGE_PREFIX.test(url.pathname) ? "" : `/${locale}`;
  return `${prefix}${url.pathname}${url.search}${url.hash}`;
}

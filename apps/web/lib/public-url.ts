import { LANGUAGE_PREFIX } from "./language-code";
export function publicUrl(path: string, locale: string, market: string) {
  const url = new URL(path, "https://local.invalid");
  url.searchParams.set("market", market);
  const prefix = LANGUAGE_PREFIX.test(url.pathname) ? "" : `/${locale}`;
  return `${prefix}${url.pathname}${url.search}`;
}

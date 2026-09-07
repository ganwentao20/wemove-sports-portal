import "server-only";
import { LANGUAGE_CODE } from "./language-code";
import { headers } from "next/headers";
export async function getLocale(): Promise<string> {
  const value = (await headers()).get("x-wemove-locale") ?? "en";
  return LANGUAGE_CODE.test(value) ? value : "en";
}
export async function getMarket() {
  return (await headers()).get("x-wemove-market") || "US";
}
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wemovetoy.com";
export function localePath(path: string, locale: string) {
  return `/${locale}${path === "/" ? "" : path}`;
}

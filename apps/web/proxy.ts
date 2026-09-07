import { LANGUAGE_PREFIX } from "./lib/language-code";
import { NextRequest, NextResponse } from "next/server";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const match = pathname.match(LANGUAGE_PREFIX);
  const headers = new Headers(request.headers);
  headers.set("x-wemove-locale", match?.[1] ?? "en");
  const market =
    request.nextUrl.searchParams.get("market") ??
    request.cookies.get("wm_market")?.value ??
    "US";
  headers.set(
    "x-wemove-market",
    /^[A-Z0-9-]{2,12}$/.test(market) ? market : "US",
  );
  headers.set("x-wemove-path", pathname);
  const contentPath = match ? pathname.slice(match[0].length) || "/" : pathname;
  if (match && !["en", "zh", "fr", "de"].includes(match[1].split("-")[0])) {
    const target = request.nextUrl.clone();
    target.pathname = `/en${contentPath === "/" ? "" : contentPath}`;
    return NextResponse.redirect(target, 307);
  }
  // These application templates currently have an English UI. Keep the entire
  // page in its available language instead of rendering English under /zh.
  if (
    match &&
    match[1] !== "en" &&
    /^\/(admin|customer|dealer|cart|checkout|orders|compare|contact|support|play-learn|dealers|cookies|newsletter)(\/|$)/.test(
      contentPath,
    )
  ) {
    const target = request.nextUrl.clone();
    target.pathname = `/en${contentPath}`;
    return NextResponse.redirect(target, 307);
  }
  if (match && match[1] !== "en") {
    try {
      const response = await fetch(
        `${process.env.API_PROXY_TARGET ?? "http://localhost:8080"}/api/v1/site/config`,
        { signal: AbortSignal.timeout(800), cache: "no-store" },
      );
      const config = await response.json();
      if (
        Array.isArray(config.data?.locale?.languages) &&
        !config.data.locale.languages.includes(match[1])
      ) {
        const target = request.nextUrl.clone();
        target.pathname = `/en${contentPath === "/" ? "" : contentPath}`;
        return NextResponse.redirect(target, 307);
      }
    } catch {}
  }
  if (!/^\/(api|admin|customer|dealer)(\/|$)/.test(contentPath)) {
    try {
      const response = await fetch(
        `${process.env.API_PROXY_TARGET ?? "http://localhost:8080"}/api/v1/site/redirect?source=${encodeURIComponent(contentPath)}`,
        { signal: AbortSignal.timeout(800), cache: "no-store" },
      );
      const body = await response.json();
      const redirect = body?.data;
      if (redirect && /^\/(?!\/)/.test(redirect.destination)) {
        const destination =
          match && !LANGUAGE_PREFIX.test(redirect.destination)
            ? `${match[0]}${redirect.destination}`
            : redirect.destination;
        return NextResponse.redirect(
          new URL(destination, request.url),
          redirect.status === 302 ? 302 : 301,
        );
      }
    } catch {
      /* API unavailability must not break static content. */
    }
  }
  if (match) {
    const url = request.nextUrl.clone();
    url.pathname = contentPath;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };

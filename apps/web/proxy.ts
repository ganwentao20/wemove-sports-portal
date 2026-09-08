import { LANGUAGE_PREFIX } from "./lib/language-code";
import { NextRequest, NextResponse } from "next/server";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const match = pathname.match(LANGUAGE_PREFIX);
  const headers = new Headers(request.headers);
  const remembered = request.cookies.get("wm_locale")?.value;
  const locale =
    match?.[1] ??
    (["en", "zh", "fr", "de"].includes(remembered ?? "") ? remembered! : "en");
  headers.set("x-wemove-locale", locale);
  const remember = (response: NextResponse) => {
    if (match && ["en", "zh", "fr", "de"].includes(locale)) {
      response.cookies.set("wm_locale", locale, {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
      });
    }
    return response;
  };
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
  // Application screens have complete English and Chinese UI dictionaries.
  // Other configured content languages still use the English application UI.
  if (
    match &&
    !["en", "zh"].includes(match[1]) &&
    /^\/(admin|customer|dealer|cart|checkout|orders|compare|contact|support|play-learn|dealers|cookies|newsletter)(\/|$)/.test(
      contentPath,
    )
  ) {
    const target = request.nextUrl.clone();
    target.pathname = `/en${contentPath}`;
    return NextResponse.redirect(target, 307);
  }
  if (match && !["en", "zh"].includes(match[1])) {
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
        return remember(
          NextResponse.redirect(
            new URL(destination, request.url),
            redirect.status === 302 ? 302 : 301,
          ),
        );
      }
    } catch {
      /* API unavailability must not break static content. */
    }
  }
  if (match) {
    const url = request.nextUrl.clone();
    url.pathname = contentPath;
    return remember(NextResponse.rewrite(url, { request: { headers } }));
  }
  return remember(NextResponse.next({ request: { headers } }));
}
export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };

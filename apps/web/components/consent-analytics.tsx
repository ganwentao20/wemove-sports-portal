"use client";
import { ui } from "../lib/ui-strings";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function saveConsent(value: string) {
  localStorage.setItem("wm_consent", value);
  document.cookie = `wm_consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event("wm-consent-change"));
}
export function recordEvent(
  name: string,
  properties: Record<string, unknown> = {},
) {
  try {
    if (
      /^\/(?:[a-z]{2,3}(?:-[A-Z]{2})?\/)?admin(?:\/|$)/.test(location.pathname)
    )
      return;
    if (localStorage.getItem("wm_consent") !== "analytics") return;
    let session = sessionStorage.getItem("wm_analytics_session");
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem("wm_analytics_session", session);
    }
    void fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        path: location.pathname,
        properties: {
          market:
            document.cookie.match(/(?:^|; )wm_market=([^;]+)/)?.[1] ?? "US",
          language: document.documentElement.lang,
          device: innerWidth < 768 ? "mobile" : "desktop",
          session_id: session,
          ...properties,
        },
        consent: true,
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {}
}
export function ConsentAnalytics({
  locale = "en",
  initialChoice = null,
}: {
  locale?: string;
  initialChoice?: string | null;
}) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<string | null>(initialChoice);
  useEffect(() => {
    const sync = () => setChoice(localStorage.getItem("wm_consent"));
    sync();
    window.addEventListener("wm-consent-change", sync);
    window.addEventListener("storage", sync);
    const click = (event: MouseEvent) => {
      const a = (event.target as Element)?.closest("a");
      if (a) {
        const target = a.getAttribute("href") ?? "";
        recordEvent("cta_click", {
          module_id:
            a.closest("[data-module-id]")?.getAttribute("data-module-id") ??
            "navigation",
          target,
        });
        if (
          location.pathname.endsWith("/search") &&
          a.closest("[data-search-results]")
        )
          recordEvent("search_click", {
            query: new URLSearchParams(location.search).get("q") ?? "",
            target,
            product_id: a.getAttribute("data-product-id") ?? "",
          });
        if (/\/media\/.+(download|file)|\/files\//.test(target))
          recordEvent("download_asset", { target });
      }
    };
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
      window.removeEventListener("wm-consent-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    const path =
      pathname.replace(/^\/[a-z]{2,3}(?:-[A-Z]{2})?(?=\/|$)/, "") || "/";
    const name =
      path === "/"
        ? "view_home"
        : /^\/products\/.+/.test(path)
          ? "view_product"
          : path === "/products"
            ? "view_product_list"
            : /^\/(content\/|play-learn)/.test(path)
              ? "view_content"
              : null;
    if (name) {
      const product = document.querySelector("[data-product-id]");
      recordEvent(name, {
        language: document.documentElement.lang,
        device: innerWidth < 768 ? "mobile" : "desktop",
        ...(product
          ? {
              product_id: product.getAttribute("data-product-id"),
              availability: product.getAttribute("data-availability"),
            }
          : {}),
      });
    }
  }, [pathname]);
  if (
    choice !== null ||
    /^\/(?:[a-z]{2,3}(?:-[A-Z]{2})?\/)?admin(?:\/|$)/.test(pathname)
  )
    return null;
  return (
    <aside
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-50 max-w-xl rounded-2xl border bg-white p-5 shadow-xl"
    >
      <h2 className="font-bold">{ui(locale, "Your privacy choices")}</h2>
      <p className="my-3 text-sm leading-6">
        {ui(
          locale,
          "Essential cookies keep sign-in and your cart working. Optional analytics help us improve the site. You can change this in Cookie settings.",
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        {[
          ["essential", "Essential only"],
          ["analytics", "Allow analytics"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              saveConsent(value);
              setChoice(value);
            }}
            className="rounded-lg border px-4 py-2 font-semibold"
          >
            {ui(locale, label)}
          </button>
        ))}
      </div>
    </aside>
  );
}

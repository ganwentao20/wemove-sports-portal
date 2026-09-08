"use client";
import { uiError } from "../../../lib/ui-i18n";
import { useUiText, useUiLocale } from "../../../components/ui-locale";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type Stats = { articles: number; faqs: number; leads: number; media: number };

const modules = [
  {
    label: "Products & stock",
    href: "/admin/products",
    permissions: ["catalog:product:read"],
  },
  { label: "Orders", href: "/admin/orders", permissions: ["order:read"] },
  {
    label: "Dealer review",
    href: "/admin/dealers",
    permissions: ["b2b:read", "b2b:dealer:read"],
  },
  {
    label: "B2B quotes & purchase orders",
    href: "/admin/b2b",
    permissions: ["b2b:read", "b2b:dealer:read"],
  },
  {
    label: "Contact inbox",
    href: "/admin/contacts",
    permissions: ["contact:read", "cms:contact:manage"],
  },
  {
    label: "CMS pages",
    href: "/admin/cms",
    permissions: ["cms:read", "cms:page:write"],
  },
  {
    label: "Media library",
    href: "/admin/media",
    permissions: ["media:read", "cms:media:write"],
  },
  {
    label: "Pricing & markets",
    href: "/admin/pricing",
    permissions: ["catalog:price:write"],
  },
  {
    label: "Customer & staff accounts",
    href: "/admin/users",
    permissions: ["user:read", "system:staff:read"],
  },
  {
    label: "Roles & permissions",
    href: "/admin/roles",
    permissions: ["system:rbac:write"],
  },
  {
    label: "Audit trail",
    href: "/admin/audit",
    permissions: ["system:audit:read"],
  },
  {
    label: "SEO & redirects",
    href: "/admin/seo",
    permissions: ["cms:read", "cms:page:write"],
  },
  { label: "Reports", href: "/admin/reports", permissions: ["reports:read"] },
  {
    label: "Site settings",
    href: "/admin/settings",
    permissions: ["system:settings:write"],
  },
  { label: "Security", href: "/admin/security", permissions: [] },
];
type Access = { roles: string[]; permissions: string[] };

export function DashboardWorkbench() {
  const t = useUiText();
  const uiLocale = useUiLocale();

  const router = useRouter();
  const [access, setAccess] = useState<Access | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const me = await secureApiFetch<Access>("staff", "/admin/me");
      if (!active) return;
      setAccess(me);
      if (
        me.roles.includes("SUPER_ADMIN") ||
        me.permissions.includes("reports:read")
      ) {
        const loaded = await secureApiFetch<Stats>("staff", "/dashboard/stats");
        if (active) setStats(loaded);
      }
    })().catch(async (cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("staff").catch(() => undefined);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load your access permissions.",
      );
    });
    return () => {
      active = false;
    };
  }, [router]);

  const can = (permissions: string[]) =>
    Boolean(
      access &&
      (access.roles.includes("SUPER_ADMIN") ||
        !permissions.length ||
        permissions.some((code) => access.permissions.includes(code))),
    );
  const visibleModules = modules.filter((item) => can(item.permissions));
  const metrics = [
    ["Published articles", stats?.articles],
    ["Published FAQs", stats?.faqs],
    ["Contact messages", stats?.leads],
    ["Media assets", stats?.media],
  ] as const;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-neutral-100 px-4 py-10"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-[#2B5F8A]">
          {t("WEMOVE ADMIN")}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{t("Operations dashboard")}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {t(
            "Live content and support metrics, with direct access to operational workbenches.",
          )}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error ? uiError(uiLocale, error) : ""}
          </p>
        )}
        {!access && !error && (
          <p role="status" className="mt-6">
            {t("Loading your workbench access…")}
          </p>
        )}
        {access && !can(["reports:read"]) && (
          <p role="status" className="mt-6 text-sm">
            {t(
              "Your role does not include dashboard reporting. Available workbenches are listed below.",
            )}
          </p>
        )}
        {can(["reports:read"]) && (
          <section
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            aria-label={t("Dashboard metrics")}
          >
            {metrics.map(([label, value]) => (
              <article
                key={label}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <p className="text-xs text-neutral-500">{t(String(label))}</p>
                <p className="mt-2 text-3xl font-bold">{value ?? "…"}</p>
              </article>
            ))}
          </section>
        )}
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{t("Workbenches")}</h2>
          {access && visibleModules.length === 1 && (
            <p className="mt-3 text-sm" role="status">
              {t(
                "No operational permissions are assigned. Contact an administrator if you need additional access.",
              )}
            </p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleModules.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="rounded-2xl border border-neutral-200 bg-white p-5 font-semibold transition hover:border-[#2B5F8A] hover:shadow-sm"
              >
                {t(String(label))} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

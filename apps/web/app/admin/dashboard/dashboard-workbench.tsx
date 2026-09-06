"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type Stats = { articles: number; faqs: number; leads: number; media: number };

const modules = [
  ["Products & stock", "/admin/products"],
  ["Orders", "/admin/orders"],
  ["Dealer review", "/admin/dealers"],
  ["Contact inbox", "/admin/contacts"],
  ["CMS pages", "/admin/cms"],
  ["Media library", "/admin/media"],
] as const;

export function DashboardWorkbench() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    secureApiFetch<Stats>("staff", "/dashboard/stats")
      .then(setStats)
      .catch(async (cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) {
          await sessionLogout("staff").catch(() => undefined);
          router.replace("/admin/login");
          return;
        }
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Unable to load dashboard metrics.",
        );
      });
  }, [router]);

  const metrics = [
    ["Published articles", stats?.articles],
    ["Published FAQs", stats?.faqs],
    ["Contact messages", stats?.leads],
    ["Media assets", stats?.media],
  ] as const;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
        <h1 className="mt-1 text-3xl font-bold">Operations dashboard</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Live content and support metrics, with direct access to operational
          workbenches.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <section
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Dashboard metrics"
        >
          {metrics.map(([label, value]) => (
            <article
              key={label}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value ?? "…"}</p>
            </article>
          ))}
        </section>
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Workbenches</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl border border-neutral-200 bg-white p-5 font-semibold transition hover:border-[#2B5F8A] hover:shadow-sm"
              >
                {label} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

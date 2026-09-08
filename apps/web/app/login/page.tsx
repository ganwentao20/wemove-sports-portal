import Link from "next/link";
import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { loginCopy } from "@/lib/login-copy";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
  title: loginCopy(locale).title,
  robots: { index: false, follow: false },
  };
}
export default async function LoginPage() {
  const locale = await getLocale(),
    t = loginCopy(locale);
  return (
    <div className="min-h-[100dvh] bg-[#f7f7f2]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-6 py-7 sm:px-10">
        <Link
          href={`/${locale}`}
          className="text-lg font-extrabold tracking-tight text-[var(--wm-dark)]"
        >
          WEMOVE
        </Link>
        <Link
          href={`/${locale}`}
          className="text-sm text-neutral-700 underline underline-offset-4"
        >
          {t.home}
        </Link>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid max-w-6xl gap-10 px-6 py-8 sm:px-10 lg:grid-cols-2 lg:gap-24 lg:py-16"
      >
        <section className="max-w-md self-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--wm-primary)]">
            WEMOVE
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--wm-dark)] sm:text-5xl">
            {t.welcome}
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-neutral-600">
            {t.intro}
          </p>
          <dl className="mt-10 hidden divide-y divide-neutral-200 lg:block">
            {[
              [t.customer, t.customerDetail],
              [t.dealer, t.dealerDetail],
              [t.staff, t.staffDetail],
            ].map(([title, description]) => (
              <div key={title} className="py-5">
                <dt className="text-sm font-semibold text-neutral-900">
                  {title}
                </dt>
                <dd className="mt-1.5 text-sm leading-6 text-neutral-600">
                  {description}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section
          aria-label={t.title}
          className="w-full max-w-lg self-start rounded-2xl border border-neutral-200 bg-white p-6 sm:p-10"
        >
          <h2 className="text-2xl font-semibold text-neutral-950">{t.title}</h2>
          <LoginForm locale={locale} />
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl gap-5 px-6 py-8 text-xs text-neutral-600 sm:px-10">
        <span>© WEMOVE</span>
        <Link href="/privacy" className="underline">
          {t.privacy}
        </Link>
        <Link href="/terms" className="underline">
          {t.terms}
        </Link>
      </footer>
    </div>
  );
}

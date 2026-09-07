import { ui } from "../lib/ui-strings";
import Link from "next/link";
import { serverApiGet } from "../lib/server-api";
import { getLocale } from "../lib/locale";
import { NewsletterForm } from "./newsletter-form";

/**
 * 全站 Footer（骨架版）：含面向消费者的合规免责（成人购买提示）占位，
 * 正式文案上线前由组长与业务核对（产品面向儿童、交易面向成年人）。
 */
export async function SiteFooter() {
  const locale = await getLocale();
  const config = await serverApiGet<{
    brand: {
      name: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      socials?: Array<{ label: string; href: string }>;
    };
  }>("/site/config");
  const brand = config.ok ? config.data.brand : { name: "WEMOVE SPORTS" };
  return (
    <footer className="mt-20 border-t border-[var(--wm-border)] bg-[var(--wm-surface)] text-[var(--wm-muted)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <p className="mb-4 text-base font-extrabold tracking-[-0.035em]">
            <span className="text-[var(--wm-dark)]">{brand.name}</span>
          </p>
          <p className="leading-6">
            {ui(locale, "Active play toys for kids & families.")}
            <br />
            {brand.address}
          </p>
          {brand.contactEmail && (
            <a
              className="mt-3 block underline"
              href={`mailto:${brand.contactEmail}`}
            >
              {brand.contactEmail}
            </a>
          )}
          {brand.contactPhone && <p className="mt-2">{brand.contactPhone}</p>}
          <ul className="mt-4 flex flex-wrap gap-4">
            {brand.socials?.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-text)]">
            {ui(locale, "Shop")}
          </p>
          <ul className="space-y-3">
            <li>
              <Link
                href={`/${locale}/products`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "All Products")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/compare`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Compare")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/search`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Search")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-text)]">
            {ui(locale, "Company")}
          </p>
          <ul className="space-y-3">
            <li>
              <Link
                href={`/${locale}/play-learn`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Play & Learn")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/support`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Support & Downloads")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/about`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "About")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/quality-safety`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Quality & Safety")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/contact`}
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Contact Us")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-text)]">
            {ui(locale, "For Business")}
          </p>
          <ul className="space-y-3">
            <li>
              <Link
                href="/dealer/apply"
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Become a Dealer")}
              </Link>
            </li>
            <li>
              <Link
                href="/dealer/login"
                className="hover:text-[var(--wm-primary)]"
              >
                {ui(locale, "Dealer Sign in")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <NewsletterForm locale={locale} />
      </div>
      <div className="border-t border-[var(--wm-border)] px-4 py-5 text-center text-xs text-[var(--wm-muted)]">
        © {new Date().getFullYear()} {brand.name}.{" "}
        {ui(locale, "Currency is shown with each price.")}
        <span className="mx-3">{ui(locale, "Adult-purchase only.")}</span>
        <Link className="mr-3 underline" href={`/${locale}/privacy`}>
          {ui(locale, "Privacy")}
        </Link>
        <Link className="mr-3 underline" href={`/${locale}/terms`}>
          {ui(locale, "Terms")}
        </Link>
        <Link className="underline" href={`/${locale}/cookies`}>
          {ui(locale, "Cookie settings")}
        </Link>{" "}
        {/* 合规位：交易对象为成年人 */}
      </div>
    </footer>
  );
}

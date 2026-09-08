import { ui } from "../lib/ui-strings";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { serverApiGet } from "../lib/server-api";
import { getLocale, getMarket } from "../lib/locale";
import { publicUrl } from "../lib/public-url";
import type { NavigationItem } from "../lib/navigation";
import { SitePreferences } from "./site-preferences";
import { AnnouncementBanner } from "./announcement-banner";
import {
  HeaderBar,
  DesktopNavigation,
  MobileNavigation,
} from "./site-navigation";
const NAV: NavigationItem[] = [
  { href: "/products", label: "Products" },
  { href: "/play-learn", label: "Play & Learn" },
  { href: "/support", label: "Support" },
  { href: "/contact", label: "Contact" },
];
export async function SiteHeader() {
  const locale = await getLocale(),
    market = await getMarket(),
    jar = await cookies();
  const [config, markets] = await Promise.all([
    serverApiGet<{
      locale: { languages: string[] };
      brand: { name: string; logo?: string };
      navigation: { items: NavigationItem[] };
    }>("/site/config"),
    serverApiGet<Array<{ code: string; label: string; currency: string }>>(
      "/commerce/markets",
    ),
  ]);
  const brand = config.ok ? config.data.brand : { name: "WEMOVE SPORTS" };
  const localized = (items: NavigationItem[]): NavigationItem[] =>
    items
      .filter((item) => !item.markets?.length || item.markets.includes(market))
      .map((item) => ({
        ...item,
        href: publicUrl(item.href, locale, market),
        label:
          item.labels?.[locale] ||
          item.labels?.[locale.split("-")[0]] ||
          (locale.split("-")[0] === "zh" && item.zh) ||
          ui(locale, item.label),
        children: item.children ? localized(item.children) : undefined,
      }));
  const nav = localized(config.ok ? config.data.navigation.items : NAV);
  const announcements = await serverApiGet<
    Array<{
      id: string;
      title: string;
      sections: Array<{ props?: { href?: string; dismissible?: boolean } }>;
    }>
  >(`/cms/pages?kind=BANNER&locale=${locale}&market=${market}`);
  const banner = announcements.ok ? announcements.data[0] : undefined;
  const dealer = jar.has("wm_dealer_session");
  const staff = jar.has("wm_staff_session");
  const customer = jar.has("wm_customer_session");
  const portals: NavigationItem[] = [
    {
      href: staff
        ? "/admin/dashboard"
        : dealer
          ? "/dealer/dashboard"
          : customer
            ? "/customer/account"
            : `/${locale}/login`,
      label: ui(
        locale,
        staff ? "Administration" : dealer ? "Dealer Portal" : "Account",
      ),
    },
    ...(!dealer
      ? [{ href: "/dealer/login", label: ui(locale, "Dealer Sign in") }]
      : []),
    { href: "/cart", label: ui(locale, "Cart") },
    { href: `/${locale}/search?market=${market}`, label: ui(locale, "Search") },
  ];
  const preferences = () => (
    <SitePreferences
      languages={config.ok ? config.data.locale.languages : undefined}
      locale={locale}
      market={market}
      markets={
        markets.ok
          ? markets.data
          : [{ code: "US", label: "United States", currency: "USD" }]
      }
    />
  );
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--wm-border)] bg-[color:color-mix(in_srgb,var(--wm-surface)_92%,transparent)] backdrop-blur-xl">
      {banner && (
        <AnnouncementBanner
          id={banner.id}
          title={banner.title}
          href={banner.sections?.[0]?.props?.href}
          dismissible={banner.sections?.[0]?.props?.dismissible !== false}
          locale={locale}
        />
      )}
      <HeaderBar>
        <Link
          href={`/${locale}`}
          className="flex shrink-0 items-baseline gap-1.5 text-[17px] font-extrabold tracking-[-0.04em]"
          aria-label={brand.name}
        >
          {brand.logo ? (
            <Image
              src={brand.logo}
              width={180}
              height={48}
              alt={brand.name}
              unoptimized={brand.logo.startsWith("https:")}
              className="max-h-12 w-auto max-w-44 object-contain"
            />
          ) : (
            <span className="max-w-48 truncate text-[var(--wm-dark)]">
              {brand.name}
            </span>
          )}
        </Link>
        <DesktopNavigation items={nav} locale={locale} />
        <div className="hidden items-center gap-3 text-sm xl:flex">
          {portals
            .filter((item) => item.href !== "/dealer/login")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-[var(--wm-muted)] hover:text-[var(--wm-primary)]"
              >
                {item.label}
              </Link>
            ))}
        </div>
        <div className="hidden xl:block">{preferences()}</div>
        <MobileNavigation items={nav} portals={portals} locale={locale}>
          {preferences()}
        </MobileNavigation>
      </HeaderBar>
    </header>
  );
}

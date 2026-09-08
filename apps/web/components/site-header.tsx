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

const ORIGINAL_NAV = [
  ["/", "首页", "Home"],
  ["/workshop", "玩具品类", "Toys"],
  ["/furniture", "家具定制", "Furniture"],
  ["/woodlab", "中试打样", "Prototyping"],
  ["/stem", "STEM教育", "STEM"],
  ["/library", "科研研发", "Research"],
  ["/public-benefit", "公益项目", "Public Benefit"],
  ["/craft-dream", "匠心筑梦", "Craft Stories"],
  ["/support/downloads", "电子说明书", "Manuals"],
] as const;

export async function SiteHeader() {
  const locale = await getLocale();
  const market = await getMarket();
  const jar = await cookies();
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
  const isZh = locale.startsWith("zh");
  const local = (path: string) => publicUrl(path, locale, market);
  const configured = config.ok ? config.data.navigation.items : [];
  const sourceNav: NavigationItem[] = configured.length
    ? configured
    : ORIGINAL_NAV.map(([href, zh, en]) => ({ href, label: en, zh }));
  const localizeNavigation = (items: NavigationItem[]): NavigationItem[] =>
    items
      .filter(
        (item) => !item.markets?.length || item.markets.includes(market),
      )
      .map((item) => ({
        ...item,
        href: item.href.startsWith("/") ? local(item.href) : item.href,
        label:
          item.labels?.[locale] ??
          (isZh ? item.labels?.zh ?? item.zh ?? item.label : item.label),
        children: item.children
          ? localizeNavigation(item.children)
          : undefined,
      }));
  const nav = localizeNavigation(sourceNav);
  const dealer = jar.has("wm_dealer_session");
  const staff = jar.has("wm_staff_session");
  const customer = jar.has("wm_customer_session");
  const portals: NavigationItem[] = [
    { href: local("/products"), label: isZh ? "产品中心" : "Product Center" },
    { href: local("/search"), label: isZh ? "搜索" : "Search" },
    { href: local("/compare"), label: isZh ? "产品对比" : "Compare" },
    { href: local("/cart"), label: isZh ? "购物车" : "Cart" },
    {
      href: staff
        ? "/admin/dashboard"
        : dealer
          ? "/dealer/dashboard"
          : customer
            ? "/customer/account"
            : `/${locale}/login`,
      label: staff
        ? isZh
          ? "管理后台"
          : "Admin"
        : dealer
          ? isZh
            ? "经销商门户"
            : "Dealer Portal"
          : isZh
            ? "账户"
            : "Account",
    },
  ];
  nav.push({
    href: local("/products"),
    label: isZh ? "购买与服务" : "Shop & Service",
    children: portals.slice(0, 5),
  });
  const announcements = await serverApiGet<
    Array<{
      id: string;
      title: string;
      sections: Array<{ props?: { href?: string; dismissible?: boolean } }>;
    }>
  >(`/cms/pages?kind=BANNER&locale=${locale}&market=${market}`);
  const banner = announcements.ok ? announcements.data[0] : undefined;
  const preferences = (
    <SitePreferences
      languages={config.ok ? config.data.locale.languages : undefined}
      locale={locale}
      market={market}
      markets={
        markets.ok
          ? markets.data.filter(
              (item) => !/^browser verification/i.test(item.label),
            )
          : [{ code: "US", label: "United States", currency: "USD" }]
      }
    />
  );
  return (
    <header className="sticky top-0 z-40 border-b border-[#e9e9e9] bg-white/95 backdrop-blur-md">
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
          href={local("/")}
          aria-label={isZh ? "WEMOVE 首页" : "WEMOVE home"}
          className="flex shrink-0 items-center gap-2 text-[20px] font-semibold tracking-[-0.03em] text-[#222]"
        >
          <Image
            src="/original-site/logo.png"
            width={32}
            height={32}
            priority
            alt="WEMOVE"
            className="h-8 w-8 object-contain"
          />
          <span>WeMove</span>
        </Link>
        <DesktopNavigation items={nav} locale={locale} />
        <div className="hidden 2xl:block">{preferences}</div>
        <MobileNavigation items={nav} portals={portals} locale={locale}>
          {preferences}
        </MobileNavigation>
      </HeaderBar>
    </header>
  );
}

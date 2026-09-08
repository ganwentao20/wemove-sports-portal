import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { DealerDashboard } from "./dashboard";
import { serverApiGet } from "../../../lib/server-api";
import { getLocale, getMarket } from "../../../lib/locale";
export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Dealer Dashboard"),
    robots: { index: false, follow: false },
  };
}
export default async function DealerDashboardPage() {
  const [locale, market] = await Promise.all([getLocale(), getMarket()]);
  const result = await serverApiGet<
    Array<{
      id: string;
      title: string;
      sections: Array<{ props?: { href?: string } }>;
    }>
  >("/cms/pages?kind=BANNER&locale=" + locale + "&market=" + market);
  const announcements = result.ok
    ? result.data.map((item) => ({
        id: item.id,
        title: item.title,
        href: item.sections.find((section) => section.props?.href)?.props?.href,
      }))
    : [];
  return <DealerDashboard announcements={announcements} />;
}

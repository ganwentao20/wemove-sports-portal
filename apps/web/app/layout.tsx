import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { getLocale } from "../lib/locale";
import { ConsentAnalytics } from "../components/consent-analytics";
import { serverApiGet } from "../lib/server-api";
import { SITE_URL } from "../lib/locale";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { WebVitals } from "../components/web-vitals";
import { UiLocaleProvider } from "../components/ui-locale";
import { PortalLanguageBar } from "../components/language-picker";
import { translateUi } from "../lib/ui-i18n";

const manrope = Manrope({
  subsets: ["latin"],
  display: "optional",
  preload: false,
  variable: "--font-body",
});

/**
 * 根布局：仅承载 <html>/<body> 与全站元信息。
 * - 根据 URL 与语言偏好提供中英文界面及基础 SEO 元信息。
 */
const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "WEMOVE：原木滚珠轨道积木与 STEM 教育",
    template: "%s | WEMOVE",
  },
  description:
    "WEMOVE 提供原木滚珠轨道积木、STEM 教育、木作创新与合作伙伴服务。",
  icons: { icon: "/original-site/logo.png" },
  keywords: [
    "WEMOVE",
    "wooden marble run",
    "STEM toys",
    "wooden blocks",
    "WEMOVE",
  ],
  openGraph: {
    siteName: "WEMOVE",
    type: "website",
    locale: "en_US",
  },
  robots: { index: process.env.DEPLOYMENT_ENV === "production", follow: true },
};
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const result = await serverApiGet<{ brand: { favicon?: string } }>(
    "/site/config",
  );
  return {
    ...baseMetadata,
    ...(locale.startsWith("zh")
      ? {
          title: {
            default: "WEMOVE：原木滚珠轨道积木与 STEM 教育",
            template: "%s | WEMOVE",
          },
          description:
            "WEMOVE 为家庭、学校和合作伙伴提供原木滚珠轨道积木、STEM 教育、木作创新与产品服务。",
          keywords: [
            "WEMOVE",
            "原木积木",
            "滚珠轨道",
            "STEM教育",
            "木制玩具",
          ],
          openGraph: { ...baseMetadata.openGraph, locale: "zh_CN" },
        }
      : {}),
    ...(result.ok && result.data.brand.favicon
      ? { icons: { icon: result.data.brand.favicon } }
      : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = await serverApiGet<{ brand: { primaryColor?: string } }>(
    "/site/config",
  );
  const locale = await getLocale();
  const color =
    config.ok && /^#[\da-f]{6}$/i.test(config.data.brand.primaryColor ?? "")
      ? config.data.brand.primaryColor
      : undefined;
  const savedConsent = (await cookies()).get("wm_consent")?.value;
  const consent =
    savedConsent === "essential" || savedConsent === "analytics"
      ? savedConsent
      : null;
  return (
    <html lang={locale}>
      <body
        className={manrope.variable}
        style={color ? ({ "--wm-primary": color } as CSSProperties) : undefined}
      >
        <UiLocaleProvider locale={locale}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:p-4"
          >
            {translateUi(locale, "Skip to content")}
          </a>
          <PortalLanguageBar />
          <div>{children}</div>
          <ConsentAnalytics locale={locale} initialChoice={consent} />
          <WebVitals />
        </UiLocaleProvider>
      </body>
    </html>
  );
}

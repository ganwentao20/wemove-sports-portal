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

const manrope = Manrope({
  subsets: ["latin"],
  display: "optional",
  preload: false,
  variable: "--font-body",
});

/**
 * 根布局：仅承载 <html>/<body> 与全站元信息。
 * - 海外市场站点，语言默认 en-US（i18n 方案待 ADR，见 docs/adr）；
 * - SEO 答辩点：metadata / sitemap / robots / OG 均在此层做基础配置。
 */
const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "WEMOVE SPORTS: Active Play Toys & Games for Kids",
    template: "%s | WEMOVE SPORTS",
  },
  description:
    "WEMOVE SPORTS designs active play toys, bowling sets, balance boards and more, for homes, schools and retailers worldwide.",
  keywords: [
    "WEMOVE",
    "active play",
    "kids sports toys",
    "bowling set",
    "balance board",
    "toy wholesale",
  ],
  openGraph: {
    siteName: "WEMOVE SPORTS",
    type: "website",
    locale: "en_US",
  },
  robots: { index: process.env.DEPLOYMENT_ENV === "production", follow: true },
};
export async function generateMetadata(): Promise<Metadata> {
  const result = await serverApiGet<{ brand: { favicon?: string } }>(
    "/site/config",
  );
  return {
    ...baseMetadata,
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
    <html lang={await getLocale()}>
      <body
        className={manrope.variable}
        style={color ? ({ "--wm-primary": color } as CSSProperties) : undefined}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:p-4"
        >
          Skip to content
        </a>
        <div>{children}</div>
        <ConsentAnalytics locale={await getLocale()} initialChoice={consent} />
        <WebVitals />
      </body>
    </html>
  );
}

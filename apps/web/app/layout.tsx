import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

/**
 * 根布局：仅承载 <html>/<body> 与全站元信息。
 * - 海外市场站点，语言默认 en-US（i18n 方案待 ADR，见 docs/adr）；
 * - SEO 答辩点：metadata / sitemap / robots / OG 均在此层做基础配置。
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://www.wemovetoy.com'),
  title: {
    default: 'WEMOVE SPORTS: Active Play Toys & Games for Kids',
    template: '%s | WEMOVE SPORTS',
  },
  description:
    'WEMOVE SPORTS designs active play toys, bowling sets, balance boards and more, for homes, schools and retailers worldwide.',
  keywords: ['WEMOVE', 'active play', 'kids sports toys', 'bowling set', 'balance board', 'toy wholesale'],
  openGraph: {
    siteName: 'WEMOVE SPORTS',
    type: 'website',
    locale: 'en_US',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}

import Link from 'next/link';
import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';

/**
 * (storefront) 官网布局：Header + 内容 + Footer
 * 模块化首页（sections 驱动）由 MD 的 CMS 输出 / 组员 A 渲染，见 CmsPage 模型。
 */
export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

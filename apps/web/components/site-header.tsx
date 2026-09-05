import Link from 'next/link';
import { SiteMobileMenu } from './site-mobile-menu';

const NAV = [
  { href: '/products', label: '产品系列' },
  { href: '/play-learn', label: '玩法灵感' },
  { href: '/support', label: '支持中心' },
  { href: '/contact', label: '联系我们' },
];

const PORTAL_LINKS = [
  { href: '/customer/login', label: '登录/注册' },
  { href: '/customer/favorites', label: '我的收藏' },
  { href: '/dealer/login', label: '经销商' },
];

/**
 * 全站 Header（骨架版，组员 A 负责响应式细化）：
 * - 移动端必须为抽屉/折叠导航，严禁横向溢出（硬指标）；
 * - 语言/货币切换占位、公告条占位。
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="announcement">满 299 元免运费 · 中文 / CNY · 课程演示站点</div>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="text-[var(--wm-primary)]">WEMOVE</span>
          <span className="text-[var(--wm-dark)]">SPORTS</span>
        </Link>

        {/* 桌面导航（≥md 显示）；移动端菜单抽屉由组员 A 实现 */}
        <nav className="hidden items-center gap-5 text-sm text-[var(--wm-gray)] md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[var(--wm-dark)]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 text-sm md:flex">
          {PORTAL_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.label === '登录/注册'
                  ? 'text-[var(--wm-gray)] hover:text-[var(--wm-dark)]'
                  : 'rounded-full border border-neutral-300 px-3 py-1.5 hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]'
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        <SiteMobileMenu nav={NAV} portals={PORTAL_LINKS} />
      </div>
    </header>
  );
}

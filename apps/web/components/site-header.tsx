import Link from 'next/link';

const NAV = [
  { href: '/products', label: 'Products' },
  { href: '/play-learn', label: 'Play & Learn' },
  { href: '/support', label: 'Support' },
  { href: '/contact', label: 'Contact' },
];

const PORTAL_LINKS = [
  { href: '/customer/login', label: 'Sign in' },
  { href: '/dealer/login', label: 'Dealer' },
  { href: '/admin/login', label: 'Admin' },
];

/**
 * 全站 Header（骨架版，组员 A 负责响应式细化）：
 * - 移动端必须为抽屉/折叠导航，严禁横向溢出（硬指标）；
 * - 语言/货币切换占位、公告条占位。
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
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
                item.label === 'Sign in'
                  ? 'text-[var(--wm-gray)] hover:text-[var(--wm-dark)]'
                  : 'rounded-full border border-neutral-300 px-3 py-1.5 hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]'
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* 移动端导航占位（组员 A）：汉堡按钮 + 抽屉 */}
        <div className="md:hidden" aria-label="Mobile navigation placeholder" />
      </div>
    </header>
  );
}

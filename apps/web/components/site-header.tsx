import Link from "next/link";

const NAV = [
  { href: "/products", label: "Products" },
  { href: "/play-learn", label: "Play & Learn" },
  { href: "/support", label: "Support" },
  { href: "/contact", label: "Contact" },
];

const PORTAL_LINKS = [
  { href: "/customer/account", label: "Account & Cart" },
  { href: "/dealer/login", label: "Dealer" },
  { href: "/admin/login", label: "Admin" },
];

/** 全站响应式 Header；移动端使用原生 details 菜单，无脚本也可访问。 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--wm-border)] bg-[color:color-mix(in_srgb,var(--wm-surface)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-1.5 text-[17px] font-extrabold tracking-[-0.04em]"
          aria-label="WEMOVE SPORTS home"
        >
          <span className="text-[var(--wm-primary)]">WEMOVE</span>
          <span className="text-[var(--wm-dark)]">SPORTS</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--wm-muted)] lg:flex" aria-label="Primary navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap transition-colors hover:text-[var(--wm-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 text-sm lg:flex">
          {PORTAL_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.label === "Account & Cart"
                  ? "whitespace-nowrap text-[var(--wm-muted)] hover:text-[var(--wm-primary)]"
                  : item.label === "Dealer"
                    ? "whitespace-nowrap rounded-xl bg-[var(--wm-dark)] px-4 py-2.5 font-semibold text-[var(--wm-surface)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                    : "whitespace-nowrap text-[var(--wm-muted)] hover:text-[var(--wm-primary)]"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        <details className="relative lg:hidden">
          <summary className="cursor-pointer list-none rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] px-4 py-2 text-sm font-semibold text-[var(--wm-text)] [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <div className="absolute right-0 top-12 w-64 rounded-2xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-3 shadow-[0_24px_60px_rgba(var(--wm-shadow)/0.18)]">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {[...NAV, ...PORTAL_LINKS].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--wm-muted)] hover:bg-[var(--wm-surface-soft)] hover:text-[var(--wm-primary)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}

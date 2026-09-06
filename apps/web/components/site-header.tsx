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
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span className="text-[var(--wm-primary)]">WEMOVE</span>
          <span className="text-[var(--wm-dark)]">SPORTS</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-[var(--wm-gray)] md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-[var(--wm-dark)]"
            >
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
                item.label === "Account & Cart"
                  ? "text-[var(--wm-gray)] hover:text-[var(--wm-dark)]"
                  : "rounded-full border border-neutral-300 px-3 py-1.5 hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <div className="absolute right-0 top-10 w-56 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {[...NAV, ...PORTAL_LINKS].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-neutral-100"
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

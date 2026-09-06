import Link from 'next/link';

/**
 * 全站 Footer（骨架版）：含面向消费者的合规免责（成人购买提示）占位，
 * 正式文案上线前由组长与业务核对（产品面向儿童、交易面向成年人）。
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--wm-border)] bg-[var(--wm-surface)] text-[var(--wm-muted)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <p className="mb-4 text-base font-extrabold tracking-[-0.035em]">
            <span className="text-[var(--wm-primary)]">WEMOVE</span>{" "}
            <span className="text-[var(--wm-dark)]">SPORTS</span>
          </p>
          <p className="leading-6">
            Active play toys for kids & families.
            <br />
            www.wemovetoy.com
          </p>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-text)]">Shop</p>
          <ul className="space-y-3">
            <li><Link href="/products" className="hover:text-[var(--wm-primary)]">All Products</Link></li>
            <li><Link href="/compare" className="hover:text-[var(--wm-primary)]">Compare</Link></li>
            <li><Link href="/search" className="hover:text-[var(--wm-primary)]">Search</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-text)]">Company</p>
          <ul className="space-y-3">
            <li><Link href="/play-learn" className="hover:text-[var(--wm-primary)]">Play &amp; Learn</Link></li>
            <li><Link href="/support" className="hover:text-[var(--wm-primary)]">Support &amp; Downloads</Link></li>
            <li><Link href="/contact" className="hover:text-[var(--wm-primary)]">Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-text)]">For Business</p>
          <ul className="space-y-3">
            <li><Link href="/dealer/apply" className="hover:text-[var(--wm-primary)]">Become a Dealer</Link></li>
            <li><Link href="/dealer/login" className="hover:text-[var(--wm-primary)]">Dealer Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--wm-border)] px-4 py-5 text-center text-xs text-[var(--wm-muted)]">
        © {new Date().getFullYear()} WEMOVE SPORTS. All prices in USD unless noted.
        Adult-purchase only. {/* 合规位：交易对象为成年人 */}
      </div>
    </footer>
  );
}

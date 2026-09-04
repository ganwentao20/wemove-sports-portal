import Link from 'next/link';

/**
 * 全站 Footer（骨架版）：含面向消费者的合规免责（成人购买提示）占位，
 * 正式文案上线前由组长与业务核对（产品面向儿童、交易面向成年人）。
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-[var(--wm-dark)] text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mb-3 font-semibold text-white">WEMOVE SPORTS</p>
          <p className="text-neutral-400">
            Active play toys for kids & families.
            <br />
            www.wemovetoy.com
          </p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Shop</p>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/products" className="hover:text-white">All Products</Link></li>
            <li><Link href="/compare" className="hover:text-white">Compare</Link></li>
            <li><Link href="/search" className="hover:text-white">Search</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Company</p>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/play-learn" className="hover:text-white">Play &amp; Learn</Link></li>
            <li><Link href="/support" className="hover:text-white">Support &amp; Downloads</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">For Business</p>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/dealer/apply" className="hover:text-white">Become a Dealer</Link></li>
            <li><Link href="/dealer/login" className="hover:text-white">Dealer Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} WEMOVE SPORTS. All prices in USD unless noted.
        Adult-purchase only. {/* 合规位：交易对象为成年人 */}
      </div>
    </footer>
  );
}

import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-[var(--wm-dark)] text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mb-3 font-semibold text-white">WEMOVE SPORTS</p>
          <p className="text-neutral-400">
            面向儿童与家庭的木质运动玩具。
            <br />
            www.wemovetoy.com
          </p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">产品</p>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/products" className="hover:text-white">全部产品</Link></li>
            <li><Link href="/compare" className="hover:text-white">产品比较</Link></li>
            <li><Link href="/search" className="hover:text-white">搜索</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">服务</p>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/play-learn" className="hover:text-white">玩法灵感</Link></li>
            <li><Link href="/support" className="hover:text-white">支持与下载</Link></li>
            <li><Link href="/contact" className="hover:text-white">联系我们</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">账号</p>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/customer/login" className="hover:text-white">登录/注册</Link></li>
            <li><Link href="/customer/account" className="hover:text-white">个人中心</Link></li>
            <li><Link href="/customer/favorites" className="hover:text-white">我的收藏</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} WEMOVE SPORTS. 页面价格为课程演示数据，真实交易需成年人确认。
      </div>
    </footer>
  );
}

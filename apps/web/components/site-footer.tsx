import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--wm-line)] bg-white text-[var(--wm-gray)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <p className="mb-4 text-base font-extrabold tracking-[-0.035em]">
            <span className="text-[var(--wm-primary)]">WEMOVE</span>{' '}
            <span className="text-[var(--wm-dark)]">SPORTS</span>
          </p>
          <p className="leading-6">
            面向儿童与家庭的木质运动玩具。
            <br />
            www.wemovetoy.com
          </p>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-dark)]">产品</p>
          <ul className="space-y-3">
            <li><Link href="/products" className="hover:text-[var(--wm-primary)]">全部产品</Link></li>
            <li><Link href="/compare" className="hover:text-[var(--wm-primary)]">产品比较</Link></li>
            <li><Link href="/search" className="hover:text-[var(--wm-primary)]">搜索</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-dark)]">内容与服务</p>
          <ul className="space-y-3">
            <li><Link href="/play" className="hover:text-[var(--wm-primary)]">内容列表</Link></li>
            <li><Link href="/stem-education" className="hover:text-[var(--wm-primary)]">STEM教育</Link></li>
            <li><Link href="/craft-dream" className="hover:text-[var(--wm-primary)]">匠心筑梦</Link></li>
            <li><Link href="/manuals" className="hover:text-[var(--wm-primary)]">电子说明书</Link></li>
            <li><Link href="/support/downloads" className="hover:text-[var(--wm-primary)]">下载中心</Link></li>
            <li><Link href="/contact" className="hover:text-[var(--wm-primary)]">联系我们</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-semibold text-[var(--wm-dark)]">账号与经销商</p>
          <ul className="space-y-3">
            <li><Link href="/customer/login" className="hover:text-[var(--wm-primary)]">登录/注册</Link></li>
            <li><Link href="/customer/account" className="hover:text-[var(--wm-primary)]">个人中心</Link></li>
            <li><Link href="/customer/favorites" className="hover:text-[var(--wm-primary)]">我的收藏</Link></li>
            <li><Link href="/dealer/apply" className="hover:text-[var(--wm-primary)]">成为经销商</Link></li>
            <li><Link href="/dealer/login" className="hover:text-[var(--wm-primary)]">经销商登录</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--wm-line)] px-4 py-5 text-center text-xs text-[var(--wm-gray)]">
        © {new Date().getFullYear()} WEMOVE SPORTS. 页面价格为课程演示数据，真实交易需成年人确认。
      </div>
    </footer>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteMobileMenu } from './site-mobile-menu';
import { CART_KEY, readStoredList } from '../lib/storefront-storage';
import { readCustomer } from '../lib/customer-store';
import { siteSections } from '../lib/site-sections';

const PRIMARY_NAV = [
  { href: '/products', label: 'Products' },
  { href: '/play', label: 'Play & Learn' },
  { href: '/support', label: 'Support' },
  { href: '/craft-dream', label: 'About' },
];

const MOBILE_NAV = [
  ...siteSections,
  { href: '/compare', label: '产品比较' },
  { href: '/search', label: '搜索' },
  { href: '/contact', label: '联系我们' },
];

const PORTAL_LINKS = [
  { href: '/customer/login', label: '登录/注册' },
  { href: '/customer/account', label: '我的账户' },
  { href: '/customer/favorites', label: '我的收藏' },
  { href: '/cart', label: '购物车' },
  { href: '/dealer/login', label: '经销商' },
];

export function StorefrontChrome() {
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [locale, setLocale] = useState('中文 / CNY');
  const [cartCount, setCartCount] = useState(0);
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    setAnnouncementVisible(window.localStorage.getItem('wemove-announcement-closed') !== '1');
    setLocale(window.localStorage.getItem('wemove-locale') || '中文 / CNY');
    setCartCount(readStoredList(CART_KEY).length);
    setCustomerName(readCustomer()?.name ?? '');
  }, []);

  const closeAnnouncement = () => {
    setAnnouncementVisible(false);
    window.localStorage.setItem('wemove-announcement-closed', '1');
  };

  const changeLocale = (value: string) => {
    setLocale(value);
    window.localStorage.setItem('wemove-locale', value);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--wm-line)] bg-white/95 backdrop-blur-xl">
      {announcementVisible ? (
        <div className="announcement">
          <span>满 299 元免运费 · 课程演示站点 · 注册/购物车/地址簿为前端演示流程</span>
          <button type="button" onClick={closeAnnouncement} aria-label="关闭站点公告">关闭</button>
        </div>
      ) : null}
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-1.5 text-[17px] font-extrabold tracking-[-0.04em]"
          aria-label="WEMOVE SPORTS home"
        >
          <span className="text-[var(--wm-primary)]">WEMOVE</span>
          <span className="text-[var(--wm-dark)]">SPORTS</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 text-sm font-medium text-[var(--wm-gray)] lg:flex" aria-label="Primary navigation">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap transition-colors hover:text-[var(--wm-primary)]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 text-sm md:flex">
          <select className="locale-switcher" value={locale} onChange={(event) => changeLocale(event.target.value)} aria-label="语言与货币切换">
            <option>中文 / CNY</option>
            <option>English / USD</option>
            <option>English / EUR</option>
          </select>
          <Link href="/search" className="whitespace-nowrap text-[var(--wm-gray)] hover:text-[var(--wm-primary)]">
            搜索
          </Link>
          <Link href={customerName ? '/customer/account' : '/customer/login'} className="whitespace-nowrap text-[var(--wm-gray)] hover:text-[var(--wm-primary)]">
            {customerName ? `你好，${customerName}` : '登录/注册'}
          </Link>
          <Link href="/dealer/login" className="whitespace-nowrap rounded-xl bg-[var(--wm-dark)] px-3 py-2 font-semibold text-white hover:bg-[var(--wm-primary)]">
            Dealer
          </Link>
          <Link href="/customer/favorites" className="whitespace-nowrap rounded-xl border border-[var(--wm-line)] bg-white px-3 py-2 font-semibold hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]">
            我的收藏
          </Link>
          <Link href="/cart" className="whitespace-nowrap rounded-xl border border-[var(--wm-line)] bg-white px-3 py-2 font-semibold hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]">
            购物车 {cartCount ? `(${cartCount})` : ''}
          </Link>
        </div>

        <SiteMobileMenu nav={MOBILE_NAV} portals={PORTAL_LINKS} locale={locale} />
      </div>
    </header>
  );
}

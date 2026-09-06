'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteMobileMenu } from './site-mobile-menu';
import { CART_KEY, readStoredList } from '../lib/storefront-storage';
import { readCustomer } from '../lib/customer-store';
import { siteSections } from '../lib/site-sections';

const NAV = siteSections;

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
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      {announcementVisible ? (
        <div className="announcement">
          <span>满 299 元免运费 · 课程演示站点 · 注册/购物车/地址簿为前端演示流程</span>
          <button type="button" onClick={closeAnnouncement} aria-label="关闭站点公告">关闭</button>
        </div>
      ) : null}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="text-[var(--wm-primary)]">WEMOVE</span>
          <span className="text-[var(--wm-dark)]">SPORTS</span>
        </Link>

        <nav className="hidden items-center gap-3 text-sm text-[var(--wm-gray)] lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[var(--wm-dark)]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 text-sm md:flex">
          <select className="locale-switcher" value={locale} onChange={(event) => changeLocale(event.target.value)} aria-label="语言与货币切换">
            <option>中文 / CNY</option>
            <option>English / USD</option>
            <option>English / EUR</option>
          </select>
          <Link href={customerName ? '/customer/account' : '/customer/login'} className="text-[var(--wm-gray)] hover:text-[var(--wm-dark)]">
            {customerName ? `你好，${customerName}` : '登录/注册'}
          </Link>
          <Link href="/customer/favorites" className="rounded-full border border-neutral-300 px-3 py-1.5 hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]">
            我的收藏
          </Link>
          <Link href="/cart" className="rounded-full border border-neutral-300 px-3 py-1.5 hover:border-[var(--wm-primary)] hover:text-[var(--wm-primary)]">
            购物车 {cartCount ? `(${cartCount})` : ''}
          </Link>
        </div>

        <SiteMobileMenu nav={NAV} portals={PORTAL_LINKS} locale={locale} />
      </div>
    </header>
  );
}

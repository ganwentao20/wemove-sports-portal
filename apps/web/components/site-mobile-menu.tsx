'use client';

import Link from 'next/link';
import { useState } from 'react';

type NavItem = {
  href: string;
  label: string;
};

export function SiteMobileMenu({ nav, portals, locale }: { nav: NavItem[]; portals: NavItem[]; locale: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="mobile-menu">
      <button
        type="button"
        className="mobile-menu-button"
        aria-expanded={open}
        aria-label={open ? '关闭导航菜单' : '打开导航菜单'}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
      {open ? (
        <div className="mobile-panel">
          {[...nav, ...portals].map((item) => (
            <Link key={item.href} href={item.href} onClick={close}>
              {item.label}
            </Link>
          ))}
          <div className="mobile-meta">{locale}</div>
        </div>
      ) : null}
    </div>
  );
}

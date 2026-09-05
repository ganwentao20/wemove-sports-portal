'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Customer = { name: string; email: string };
type Address = { name: string; phone: string; detail: string };

export function CustomerDashboard() {
  const [customer, setCustomer] = useState<Customer | null>(null); const [addresses, setAddresses] = useState<Address[]>([]);
  useEffect(() => { setCustomer(JSON.parse(localStorage.getItem('wemove-customer') ?? 'null')); setAddresses(JSON.parse(localStorage.getItem('wemove-addresses') ?? '[]')); }, []);
  function addAddress(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const address = Object.fromEntries(new FormData(event.currentTarget)) as Address; const next = [...addresses, address]; setAddresses(next); localStorage.setItem('wemove-addresses', JSON.stringify(next)); event.currentTarget.reset(); }
  if (!customer) return <section className="account-empty"><h1>我的账户</h1><p>请先登录后管理个人资料、地址簿和收藏。</p><Link href="/customer/login">前往登录</Link></section>;
  return <section className="account-page"><div><h1>你好，{customer.name}</h1><p>{customer.email}</p></div><div className="account-grid"><article><h2>个人资料</h2><p>资料将由认证接口接入后同步保存。</p><button onClick={() => { localStorage.removeItem('wemove-customer'); setCustomer(null); }}>退出登录</button></article><article><h2>地址簿</h2>{addresses.length ? <ul>{addresses.map((item, index) => <li key={`${item.phone}-${index}`}><strong>{item.name}</strong><span>{item.phone} · {item.detail}</span></li>)}</ul> : <p>尚未添加收货地址。</p>}<form onSubmit={addAddress}><input name="name" required placeholder="收件人" /><input name="phone" required placeholder="手机号" /><input name="detail" required placeholder="省市区及详细地址" /><button>新增地址</button></form></article><article><h2>我的收藏</h2><p>收藏的产品会保存在当前浏览器中。</p><Link href="/products">浏览产品</Link></article><article><h2>订单与售后</h2><p>订单、退款和物流状态将在成员 C 的交易接口接入后显示。</p></article></div></section>;
}

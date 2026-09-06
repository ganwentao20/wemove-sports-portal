'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  deleteAddress,
  getCurrentCustomer,
  listAddresses,
  logoutCustomer,
  saveCustomerProfile,
  setDefaultAddress,
  upsertAddress,
} from '../lib/storefront-api';
import type { Address, Customer } from '../lib/customer-store';

export function CustomerDashboard() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void getCurrentCustomer().then((result) => setCustomer(result.user));
    void listAddresses().then(setAddresses);
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      name: String(form.get('name') ?? ''),
      email: customer?.email ?? String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      country: String(form.get('country') ?? ''),
    };
    setCustomer(await saveCustomerProfile(next));
    setMessage('个人资料已保存。后续有 profile 接口时将自动替换为接口保存。');
  }

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const address: Address = {
      id: crypto.randomUUID(),
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      province: String(form.get('province') ?? ''),
      city: String(form.get('city') ?? ''),
      detail: String(form.get('detail') ?? ''),
      isDefault: addresses.length === 0 || Boolean(form.get('isDefault')),
    };
    setAddresses(await upsertAddress(address));
    setMessage('地址已新增，可在购物车结算演示中使用。');
    event.currentTarget.reset();
  }

  async function markDefault(id: string) {
    setAddresses(await setDefaultAddress(id));
    setMessage('已设置默认地址。');
  }

  async function removeAddress(id: string) {
    setAddresses(await deleteAddress(id));
    setMessage('地址已删除。');
  }

  async function logout() {
    await logoutCustomer();
    setCustomer(null);
  }

  if (!customer) return <section className="account-empty"><h1>我的账户</h1><p>请先登录后管理个人资料、地址簿、购物车和收藏。</p><Link href="/customer/login">前往登录</Link></section>;

  return (
    <section className="account-page">
      <div>
        <h1>你好，{customer.name}</h1>
        <p>{customer.email}</p>
        {message ? <p className="action-message">{message}</p> : null}
      </div>
      <div className="account-grid">
        <article>
          <h2>个人资料</h2>
          <form onSubmit={saveProfile}>
            <input name="name" required defaultValue={customer.name} placeholder="姓名" />
            <input name="email" type="email" disabled defaultValue={customer.email} placeholder="邮箱" />
            <input name="phone" defaultValue={customer.phone ?? ''} placeholder="联系电话" />
            <input name="country" defaultValue={customer.country ?? '中国'} placeholder="国家/地区" />
            <button>保存资料</button>
          </form>
          <button className="ghost-button" onClick={logout}>退出登录</button>
        </article>

        <article className="address-book">
          <h2>地址簿</h2>
          {addresses.length ? (
            <ul>
              {addresses.map((item) => (
                <li key={item.id}>
                  <strong>{item.name} {item.isDefault ? <em>默认</em> : null}</strong>
                  <span>{item.phone} · {item.province}{item.city}{item.detail}</span>
                  <div>
                    <button type="button" onClick={() => markDefault(item.id)}>设为默认</button>
                    <button type="button" onClick={() => removeAddress(item.id)}>删除</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p>尚未添加收货地址。</p>}
          <form onSubmit={addAddress}>
            <input name="name" required placeholder="收件人" />
            <input name="phone" required placeholder="手机号" />
            <input name="province" required placeholder="省/直辖市" />
            <input name="city" required placeholder="城市/区县" />
            <input name="detail" required placeholder="详细地址" />
            <label className="inline-check"><input name="isDefault" type="checkbox" />设为默认地址</label>
            <button>新增地址</button>
          </form>
        </article>

        <article>
          <h2>我的收藏</h2>
          <p>支持查看已收藏产品，并可进入详情或取消收藏。</p>
          <Link href="/customer/favorites">查看收藏</Link>
        </article>

        <article>
          <h2>账户安全</h2>
          <p>找回密码已按组长接口 POST /api/v1/auth/forgot-password 预接线。</p>
          <Link href="/customer/forgot-password">找回密码</Link>
        </article>
      </div>
    </section>
  );
}

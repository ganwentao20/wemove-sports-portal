'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { products } from '../lib/products';
import { readAddresses, readCartItems, type CartItem } from '../lib/customer-store';
import { clearCart, saveCart } from '../lib/storefront-api';

const priceNumber = (value: string) => Number(value.replace(/[^\d.]/g, '')) || 0;

function normalizeCart(items: CartItem[]) {
  const merged = new Map<string, CartItem>();
  for (const item of items) {
    const key = `${item.slug}:${item.kit}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += item.quantity;
    else merged.set(key, { ...item, id: key });
  }
  return Array.from(merged.values());
}

export function CartClient() {
  const [items, setItems] = useState<CartItem[]>(() => (typeof window === 'undefined' ? [] : normalizeCart(readCartItems())));
  const [coupon, setCoupon] = useState('');
  const [message, setMessage] = useState('购物车当前为前端演示数据，后续可接成员 C 的 cart/order 接口。');
  const addresses = typeof window === 'undefined' ? [] : readAddresses();
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  const rows = useMemo(
    () =>
      items
        .map((item) => ({ item, product: products.find((product) => product.slug === item.slug) }))
        .filter((row): row is { item: CartItem; product: (typeof products)[number] } => Boolean(row.product)),
    [items],
  );

  const subtotal = rows.reduce((sum, row) => sum + priceNumber(row.product.price) * row.item.quantity, 0);
  const discount = coupon.trim().toUpperCase() === 'WEMOVE' ? Math.round(subtotal * 0.1) : 0;
  const shipping = subtotal - discount >= 299 || subtotal === 0 ? 0 : 28;
  const total = Math.max(0, subtotal - discount + shipping);

  const save = (next: CartItem[]) => {
    setItems(next);
    void saveCart(next);
  };

  const updateQuantity = (id: string, quantity: number) => {
    save(items.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, Math.min(9, quantity)) } : item)));
  };

  const remove = (id: string) => {
    save(items.filter((item) => item.id !== id));
    setMessage('已从购物车移除该商品。');
  };

  const checkout = () => {
    if (!rows.length) {
      setMessage('购物车为空，先去产品页选择商品。');
      return;
    }
    if (!defaultAddress) {
      setMessage('请先到“我的账户”新增地址，才能完成结算演示。');
      return;
    }
    setMessage(`已生成结算演示：收货人 ${defaultAddress.name}，应付 ￥${total}。订单接口由成员 C 接入后会真实创建订单。`);
  };

  const clear = () => {
    setItems([]);
    void clearCart();
    setMessage('购物车已清空。');
  };

  return (
    <section className="cart-page">
      <div className="cart-heading">
        <div>
          <h1>购物车</h1>
          <p>支持改数量、删除、优惠码、默认地址结算演示。正式库存、订单与支付接口由成员 C 接入。</p>
        </div>
        <Link href="/products">继续选购</Link>
      </div>

      {rows.length ? (
        <div className="cart-layout">
          <div className="cart-items">
            {rows.map(({ item, product }) => (
              <article key={item.id}>
                <Image src={product.image} alt={product.name} width={220} height={160} />
                <div>
                  <h2>{product.name}</h2>
                  <p>{item.kit}</p>
                  <span>{product.price}</span>
                </div>
                <label>
                  数量
                  <input type="number" min="1" max="9" value={item.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value) || 1)} />
                </label>
                <button type="button" onClick={() => remove(item.id)}>删除</button>
              </article>
            ))}
          </div>

          <aside className="cart-summary">
            <h2>订单摘要</h2>
            <label>
              优惠码
              <input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="输入 WEMOVE 体验 9 折" />
            </label>
            <dl>
              <div><dt>商品小计</dt><dd>￥{subtotal}</dd></div>
              <div><dt>优惠</dt><dd>- ￥{discount}</dd></div>
              <div><dt>运费</dt><dd>{shipping ? `￥${shipping}` : '免运费'}</dd></div>
              <div><dt>合计</dt><dd>￥{total}</dd></div>
            </dl>
            <div className="address-preview">
              <strong>默认收货地址</strong>
              {defaultAddress ? <p>{defaultAddress.name} · {defaultAddress.phone}<br />{defaultAddress.province}{defaultAddress.city}{defaultAddress.detail}</p> : <p>还没有地址，请先新增。</p>}
              <Link href="/customer/account">管理地址簿</Link>
            </div>
            <button type="button" onClick={checkout}>提交订单演示</button>
            <button className="ghost-button" type="button" onClick={clear}>清空购物车</button>
            <p className="action-message">{message}</p>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          购物车还是空的。请进入产品详情页选择规格和数量后加入购物车。
          <Link href="/products">去产品列表</Link>
        </div>
      )}
    </section>
  );
}

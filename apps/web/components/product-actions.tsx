'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Product } from '../lib/products';
import { CART_KEY, COMPARE_KEY, FAVORITES_KEY, addStoredItem, readStoredList, toggleStoredItem, writeStoredList } from '../lib/storefront-storage';

export function ProductActions({ product }: { product: Product }) {
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [kit, setKit] = useState(product.pieces);

  const addCart = () => {
    const cart = readStoredList(CART_KEY);
    writeStoredList(CART_KEY, [...cart, ...Array.from({ length: quantity }, () => `${product.slug}:${kit}`)]);
    setMessage(`已加入购物车演示数据：${product.name} / ${kit} / ${quantity} 件。正式下单接口由成员 C 接入。`);
  };

  const addCompare = () => {
    const result = addStoredItem(COMPARE_KEY, product.slug, 4);
    if (result.reason === 'exists') {
      setMessage('这款产品已经在比较列表中。');
      return;
    }
    if (result.reason === 'limit') {
      setMessage('最多比较 4 款产品，请先到比较页移除一款。');
      return;
    }
    setMessage('已加入产品比较。');
  };

  const addFavorite = () => {
    const next = toggleStoredItem(FAVORITES_KEY, product.slug);
    setMessage(next.includes(product.slug) ? '已加入我的收藏。' : '已从我的收藏移除。');
  };

  return (
    <>
      <div className="purchase-panel">
        <label>
          规格
          <select value={kit} onChange={(event) => setKit(event.target.value)}>
            <option value={product.pieces}>{product.pieces} 标准配置</option>
            <option value={`${product.pieces} + 拓展轨道`}>{product.pieces} + 拓展轨道</option>
            <option value={`${product.pieces} + 教学活动卡`}>{product.pieces} + 教学活动卡</option>
          </select>
        </label>
        <label>
          数量
          <input
            type="number"
            min="1"
            max="9"
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(9, Number(event.target.value) || 1)))}
          />
        </label>
      </div>
      <div className="detail-actions">
        <button type="button" onClick={addCart}>加入购物车</button>
        <button type="button" onClick={addCompare}>加入比较</button>
        <button type="button" onClick={addFavorite}>收藏</button>
        <Link href="/compare">查看比较</Link>
      </div>
      {message ? <p className="action-message">{message}</p> : null}
    </>
  );
}

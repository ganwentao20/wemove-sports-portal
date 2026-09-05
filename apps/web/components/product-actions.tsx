'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Product } from '../lib/products';

const readList = (key: string) => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]') as string[];
  } catch {
    return [];
  }
};

const writeList = (key: string, value: string[]) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

export function ProductActions({ product }: { product: Product }) {
  const [message, setMessage] = useState('');

  const addCart = () => {
    const cart = readList('wemove-cart');
    writeList('wemove-cart', Array.from(new Set([...cart, product.slug])));
    setMessage('已加入购物车演示数据，正式下单接口由成员 C 接入。');
  };

  const addCompare = () => {
    const compare = readList('wemove-compare');
    if (compare.includes(product.slug)) {
      setMessage('这款产品已经在比较列表中。');
      return;
    }
    if (compare.length >= 4) {
      setMessage('最多比较 4 款产品，请先到比较页移除一款。');
      return;
    }
    writeList('wemove-compare', [...compare, product.slug]);
    setMessage('已加入产品比较。');
  };

  const addFavorite = () => {
    const favorites = readList('wemove-favorites');
    writeList('wemove-favorites', Array.from(new Set([...favorites, product.slug])));
    setMessage('已加入我的收藏。');
  };

  return (
    <>
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

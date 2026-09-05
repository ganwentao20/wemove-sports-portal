'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Product } from '../lib/products';

const key = 'wemove-favorites';

export function ProductCard({ product }: { product: Product }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(JSON.parse(localStorage.getItem(key) ?? '[]').includes(product.slug)), [product.slug]);
  function toggleSave() {
    const current: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    const next = current.includes(product.slug) ? current.filter((id) => id !== product.slug) : [...current, product.slug];
    localStorage.setItem(key, JSON.stringify(next)); setSaved(next.includes(product.slug));
  }
  return <article className="product-card">
    <Link href={`/products/${product.slug}`}><img src={product.image} alt={product.name} /><div><p>{product.age} · 天然木材</p><h3>{product.name}</h3><span>{product.description}</span></div></Link>
    <button type="button" onClick={toggleSave} aria-pressed={saved}>{saved ? '已收藏' : '收藏'}</button>
  </article>;
}

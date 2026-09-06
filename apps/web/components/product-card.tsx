'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Product } from '../lib/products';
import { COMPARE_KEY, FAVORITES_KEY, addStoredItem, readStoredList, toggleStoredItem } from '../lib/storefront-storage';

export function ProductCard({ product }: { product: Product }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setSaved(readStoredList(FAVORITES_KEY).includes(product.slug)), [product.slug]);

  function toggleSave() {
    const next = toggleStoredItem(FAVORITES_KEY, product.slug);
    const isSaved = next.includes(product.slug);
    setSaved(isSaved);
    setMessage(isSaved ? '已加入收藏' : '已取消收藏');
  }

  function addCompare() {
    const result = addStoredItem(COMPARE_KEY, product.slug, 4);
    if (result.reason === 'exists') setMessage('已在比较列表');
    else if (result.reason === 'limit') setMessage('比较最多 4 款');
    else setMessage('已加入比较');
  }

  return (
    <article className="product-card">
      <Link href={`/products/${product.slug}`}>
        <img src={product.image} alt={product.name} />
        <div>
          <p>{product.age} · {product.scene}</p>
          <h3>{product.name}</h3>
          <span>{product.description}</span>
        </div>
      </Link>
      <div className="card-actions">
        <button type="button" onClick={toggleSave} aria-pressed={saved}>{saved ? '已收藏' : '收藏'}</button>
        <button type="button" onClick={addCompare}>加入比较</button>
      </div>
      {message ? <small>{message}</small> : null}
    </article>
  );
}

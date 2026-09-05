'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProductCard } from './product-card';
import type { Product } from '../lib/products';

export function FavoritesClient({ products }: { products: Product[] }) {
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);

  useEffect(() => {
    try {
      setFavoriteSlugs(JSON.parse(window.localStorage.getItem('wemove-favorites') || '[]'));
    } catch {
      setFavoriteSlugs([]);
    }
  }, []);

  const favorites = useMemo(
    () => favoriteSlugs.map((slug) => products.find((product) => product.slug === slug)).filter(Boolean) as Product[],
    [favoriteSlugs, products],
  );

  return (
    <div className="catalog">
      <h1>我的收藏</h1>
      <p>收藏数据先保存在本地浏览器中，登录接口完成后可以同步到用户账户。</p>
      {favorites.length ? (
        <div className="product-grid">
          {favorites.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          还没有收藏商品。
          <Link href="/products">去浏览产品</Link>
        </div>
      )}
    </div>
  );
}

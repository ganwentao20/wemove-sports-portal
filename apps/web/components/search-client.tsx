'use client';

import { useMemo, useState } from 'react';
import { ProductCard } from './product-card';
import type { Product } from '../lib/products';

export function SearchClient({ products }: { products: Product[] }) {
  const [keyword, setKeyword] = useState('');
  const result = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return [];
    return products.filter((product) => `${product.name} ${product.description} ${product.scene}`.toLowerCase().includes(value));
  }, [keyword, products]);

  return (
    <div className="search-page">
      <h1>搜索</h1>
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="输入 Cugolino、转盘、亲子共玩等关键词"
        aria-label="搜索关键词"
      />
      <p>{keyword ? `找到 ${result.length} 个结果` : '请输入关键词查找产品。'}</p>
      <div className="product-grid">
        {result.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}

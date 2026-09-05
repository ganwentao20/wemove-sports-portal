'use client';

import { useMemo, useState } from 'react';
import { ProductCard } from './product-card';
import type { Product } from '../lib/products';

const FILTERS = ['全部', '3 岁及以上', '4 岁及以上', '亲子共玩', '搭建探索', '空间思维'];

export function ProductCatalog({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');

  const visibleProducts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return products.filter((product) => {
      const matchFilter = filter === '全部' || product.tags.includes(filter) || product.scene === filter;
      const searchable = `${product.name} ${product.description} ${product.scene}`.toLowerCase();
      return matchFilter && (!normalized || searchable.includes(normalized));
    });
  }, [filter, keyword, products]);

  return (
    <>
      <div className="catalog-tools">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索产品名称、玩法或场景"
          aria-label="搜索产品"
        />
        <div className="filter-buttons" aria-label="商品筛选">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <p className="result-count">已找到 {visibleProducts.length} 款产品</p>
      <div className="product-grid">
        {visibleProducts.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </>
  );
}

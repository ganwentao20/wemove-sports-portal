'use client';

import { useMemo, useState } from 'react';
import { ProductCard } from './product-card';
import type { Product } from '../lib/products';

const FILTERS = ['全部', '3 岁及以上', '4 岁及以上', '亲子共玩', '搭建探索', '空间思维'];
const SORTS = [
  { label: '默认排序', value: 'default' },
  { label: '价格从低到高', value: 'price-asc' },
  { label: '价格从高到低', value: 'price-desc' },
  { label: '件数从多到少', value: 'pieces-desc' },
];

const numberFromText = (value: string) => Number(value.replace(/[^\d.]/g, '')) || 0;

export function ProductCatalog({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('default');

  const visibleProducts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchFilter = filter === '全部' || product.tags.includes(filter) || product.scene === filter;
      const searchable = `${product.name} ${product.description} ${product.scene} ${product.age} ${product.pieces}`.toLowerCase();
      return matchFilter && (!normalized || searchable.includes(normalized));
    });

    return [...filtered].sort((first, second) => {
      if (sort === 'price-asc') return numberFromText(first.price) - numberFromText(second.price);
      if (sort === 'price-desc') return numberFromText(second.price) - numberFromText(first.price);
      if (sort === 'pieces-desc') return numberFromText(second.pieces) - numberFromText(first.pieces);
      return 0;
    });
  }, [filter, keyword, products, sort]);

  return (
    <>
      <div className="catalog-tools">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索产品名称、玩法或场景"
          aria-label="搜索产品"
        />
        <select aria-label="产品排序" value={sort} onChange={(event) => setSort(event.target.value)}>
          {SORTS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
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
      <p className="result-count">已找到 {visibleProducts.length} 款产品 · 当前筛选：{filter} · 当前排序：{SORTS.find((item) => item.value === sort)?.label}</p>
      {visibleProducts.length ? (
        <div className="product-grid">
          {visibleProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          没有找到匹配产品。可以清空搜索词，或切换到“全部”分类。
          <button type="button" onClick={() => { setKeyword(''); setFilter('全部'); setSort('default'); }}>重置筛选</button>
        </div>
      )}
    </>
  );
}

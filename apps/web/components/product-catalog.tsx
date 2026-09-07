'use client';

import { useMemo, useState } from 'react';
import { ProductCard } from './product-card';
import { productCategories, type Product } from '../lib/products';

const PAGE_SIZE = 6;

const SORTS = [
  { label: '默认排序', value: 'default' },
  { label: '价格从低到高', value: 'price-asc' },
  { label: '价格从高到低', value: 'price-desc' },
  { label: '件数从多到少', value: 'pieces-desc' },
];

const numberFromText = (value: string) => Number(value.replace(/[^\d.]/g, '')) || 0;

export function ProductCatalog({ products }: { products: Product[] }) {
  const [category, setCategory] = useState('全部');
  const [age, setAge] = useState('全部');
  const [scene, setScene] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('default');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filterOptions = useMemo(() => {
    const ages = Array.from(new Set(products.map((product) => product.age)));
    const scenes = Array.from(new Set(products.map((product) => product.scene)));
    return {
      categories: ['全部', ...productCategories.map((item) => item.label)],
      ages: ['全部', ...ages],
      scenes: ['全部', ...scenes],
    };
  }, [products]);

  const visibleProducts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchCategory = category === '全部' || product.categoryLabel === category;
      const matchAge = age === '全部' || product.age === age || product.tags.includes(age);
      const matchScene = scene === '全部' || product.scene === scene || product.tags.includes(scene);
      const searchable = `${product.name} ${product.description} ${product.categoryLabel} ${product.scene} ${product.age} ${product.pieces}`.toLowerCase();
      return matchCategory && matchAge && matchScene && (!normalized || searchable.includes(normalized));
    });

    return [...filtered].sort((first, second) => {
      if (sort === 'price-asc') return numberFromText(first.price) - numberFromText(second.price);
      if (sort === 'price-desc') return numberFromText(second.price) - numberFromText(first.price);
      if (sort === 'pieces-desc') return numberFromText(second.pieces) - numberFromText(first.pieces);
      return 0;
    });
  }, [age, category, keyword, products, scene, sort]);

  const pagedProducts = visibleProducts.slice(0, visibleCount);
  const pendingCategory = productCategories.some((item) => item.label === category && item.status === 'pending-assets');

  const resetFilters = () => {
    setKeyword('');
    setCategory('全部');
    setAge('全部');
    setScene('全部');
    setSort('default');
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <>
      <div className="catalog-tools">
        <label>
          搜索
          <input
            value={keyword}
            onChange={(event) => { setKeyword(event.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="搜索产品名称、玩法或场景"
            aria-label="搜索产品"
          />
        </label>
        <label>
          分类
          <select aria-label="产品分类" value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }}>
            {filterOptions.categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          年龄
          <select aria-label="年龄筛选" value={age} onChange={(event) => { setAge(event.target.value); setVisibleCount(PAGE_SIZE); }}>
            {filterOptions.ages.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          场景
          <select aria-label="场景筛选" value={scene} onChange={(event) => { setScene(event.target.value); setVisibleCount(PAGE_SIZE); }}>
            {filterOptions.scenes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          排序
          <select aria-label="产品排序" value={sort} onChange={(event) => { setSort(event.target.value); setVisibleCount(PAGE_SIZE); }}>
            {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <div className="catalog-actions">
          <button type="button" onClick={resetFilters}>重置筛选</button>
        </div>
      </div>
      <div className="result-count">
        <span>已找到 {visibleProducts.length} 款产品</span>
        <span>分类：{category}</span>
        <span>年龄：{age}</span>
        <span>场景：{scene}</span>
      </div>
      {visibleProducts.length ? (
        <>
          <div className="product-grid catalog-grid">
            {pagedProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          {visibleCount < visibleProducts.length ? (
            <div className="load-more">
              <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>加载更多产品</button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          {pendingCategory
            ? `“${category}”栏目已按原网站保留入口，产品素材和接口待成员补充后可直接接入。`
            : '没有找到匹配产品。可以清空搜索词，或切换到“全部”分类。'}
          <button type="button" onClick={resetFilters}>重置筛选</button>
        </div>
      )}
    </>
  );
}

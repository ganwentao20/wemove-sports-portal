'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../lib/products';

const storageKey = 'wemove-compare';

export function CompareClient({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    try {
      setSelected(JSON.parse(window.localStorage.getItem(storageKey) || '[]'));
    } catch {
      setSelected([]);
    }
  }, []);

  const compared = useMemo(
    () => selected.map((slug) => products.find((product) => product.slug === slug)).filter(Boolean) as Product[],
    [products, selected],
  );

  const save = (next: string[]) => {
    setSelected(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const add = (slug: string) => {
    if (!slug || selected.includes(slug) || selected.length >= 4) return;
    save([...selected, slug]);
  };

  const remove = (slug: string) => save(selected.filter((item) => item !== slug));

  return (
    <div className="compare-page">
      <h1>产品比较</h1>
      <p>最多选择 4 款产品，比较年龄、玩法、尺寸、重量、材质、价格和状态。移动端会自动改为纵向卡片。</p>
      <div className="compare-picker">
        <select aria-label="选择要比较的产品" onChange={(event) => add(event.target.value)} value="">
          <option value="">添加产品到比较</option>
          {products.map((product) => (
            <option key={product.slug} value={product.slug} disabled={selected.includes(product.slug)}>
              {product.name}
            </option>
          ))}
        </select>
        <Link href="/products">返回产品列表</Link>
      </div>
      {compared.length === 0 ? (
        <div className="empty-state">还没有选择产品。可以从商品详情页或上方下拉框加入比较。</div>
      ) : (
        <div className="compare-grid" style={{ ['--count' as string]: compared.length }}>
          {compared.map((product) => (
            <article key={product.slug}>
              <Image src={product.image} alt={product.name} width={420} height={280} />
              <h2>{product.name}</h2>
              <dl>
                <div><dt>推荐年龄</dt><dd>{product.age}</dd></div>
                <div><dt>玩法场景</dt><dd>{product.scene}</dd></div>
                <div><dt>材质</dt><dd>{product.material}</dd></div>
                <div><dt>尺寸</dt><dd>{product.size}</dd></div>
                <div><dt>重量</dt><dd>{product.weight}</dd></div>
                <div><dt>件数</dt><dd>{product.pieces}</dd></div>
                <div><dt>参考价格</dt><dd>{product.price}</dd></div>
                <div><dt>状态</dt><dd>{product.status}</dd></div>
              </dl>
              <button type="button" onClick={() => remove(product.slug)}>移除</button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

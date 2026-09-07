'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../lib/products';
import { COMPARE_KEY, readStoredList, writeStoredList } from '../lib/storefront-storage';

const COMPARE_FIELDS = [
  { label: '推荐年龄', value: (product: Product) => product.age },
  { label: '玩法场景', value: (product: Product) => product.scene },
  { label: '材质', value: (product: Product) => product.material },
  { label: '尺寸', value: (product: Product) => product.size },
  { label: '重量', value: (product: Product) => product.weight },
  { label: '件数', value: (product: Product) => product.pieces },
  { label: '参考价格', value: (product: Product) => product.price },
  { label: '状态', value: (product: Product) => product.status },
];

export function CompareClient({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stored = readStoredList(COMPARE_KEY).slice(0, 4);
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('items')?.split(',').filter(Boolean).slice(0, 4) ?? [];
    const next = shared.length ? shared : stored;
    setSelected(next);
    if (shared.length) writeStoredList(COMPARE_KEY, shared);
  }, []);

  const compared = useMemo(
    () => selected.map((slug) => products.find((product) => product.slug === slug)).filter(Boolean) as Product[],
    [products, selected],
  );

  const save = (next: string[]) => {
    setSelected(next);
    writeStoredList(COMPARE_KEY, next);
    setMessage('');
  };

  const add = (slug: string) => {
    if (!slug) return;
    if (selected.includes(slug)) {
      setMessage('这款产品已经在比较列表中。');
      return;
    }
    if (selected.length >= 4) {
      setMessage('最多只能比较 4 款产品，请先移除一款。');
      return;
    }
    save([...selected, slug]);
  };

  const remove = (slug: string) => save(selected.filter((item) => item !== slug));
  const shareHref = selected.length ? `/compare?items=${selected.join(',')}` : '/compare';

  async function copyShareLink() {
    const url = `${window.location.origin}${shareHref}`;
    await navigator.clipboard?.writeText(url);
    setMessage('已复制比较链接。');
  }

  return (
    <div className="compare-page">
      <div className="compare-heading">
        <span className="eyebrow">Product compare</span>
        <h1>产品比较</h1>
        <p>最多选择 4 款产品，比较年龄、玩法、尺寸、重量、材质、价格和状态。不同字段会自动高亮，移动端会改为纵向卡片。</p>
      </div>
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
        <button type="button" onClick={copyShareLink} disabled={selected.length === 0}>复制分享链接</button>
      </div>
      {message ? <p className="action-message">{message}</p> : null}
      {compared.length === 0 ? (
        <div className="empty-state">还没有选择产品。可以从商品详情页或上方下拉框加入比较。</div>
      ) : (
        <div className="compare-grid" style={{ ['--count' as string]: compared.length }}>
          {compared.map((product) => (
            <article key={product.slug}>
              <Image src={product.image} alt={product.name} width={420} height={280} />
              <h2>{product.name}</h2>
              <dl>
                {COMPARE_FIELDS.map((field) => {
                  const value = field.value(product);
                  const allValues = compared.map((item) => field.value(item));
                  const isDifferent = new Set(allValues).size > 1;
                  return (
                    <div key={field.label} className={isDifferent ? 'is-different' : ''}>
                      <dt>{field.label}</dt>
                      <dd>{value}</dd>
                    </div>
                  );
                })}
              </dl>
              <div className="compare-card-actions">
                <Link href={`/products/${product.slug}`}>查看详情</Link>
                <button type="button" onClick={() => remove(product.slug)}>移除</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

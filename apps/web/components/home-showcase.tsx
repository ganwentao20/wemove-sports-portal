'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Product } from '../lib/products';
import { COMPARE_KEY, FAVORITES_KEY, addStoredItem, toggleStoredItem } from '../lib/storefront-storage';

const scenes = ['全部', '亲子共玩', '搭建探索', '空间思维'];

export function HomeShowcase({ products }: { products: Product[] }) {
  const [scene, setScene] = useState('全部');
  const [activeSlug, setActiveSlug] = useState(products[0]?.slug ?? '');
  const [message, setMessage] = useState('选择一个系列，页面会即时切换展示重点。');

  const visibleProducts = useMemo(
    () => (scene === '全部' ? products : products.filter((product) => product.scene === scene)),
    [products, scene],
  );

  const activeProduct = products.find((product) => product.slug === activeSlug) ?? visibleProducts[0] ?? products[0];

  const chooseScene = (nextScene: string) => {
    const nextProducts = nextScene === '全部' ? products : products.filter((product) => product.scene === nextScene);
    setScene(nextScene);
    if (nextProducts[0]) setActiveSlug(nextProducts[0].slug);
    setMessage(`已切换到「${nextScene}」场景。`);
  };

  const saveFavorite = () => {
    const next = toggleStoredItem(FAVORITES_KEY, activeProduct.slug);
    setMessage(next.includes(activeProduct.slug) ? `已收藏「${activeProduct.name}」。` : `已取消收藏「${activeProduct.name}」。`);
  };

  const addCompare = () => {
    const result = addStoredItem(COMPARE_KEY, activeProduct.slug, 4);
    if (result.reason === 'exists') setMessage('这款产品已经在比较列表里。');
    else if (result.reason === 'limit') setMessage('最多比较 4 款产品，请先去比较页移除一款。');
    else setMessage(`已把「${activeProduct.name}」加入产品比较。`);
  };

  return (
    <section className="home-section interactive-showcase" id="showcase">
      <div className="section-title">
        <div>
          <h2>按家庭场景挑选产品</h2>
          <p>不等后端接口，前端先完成可点击、可筛选、可收藏、可对比的演示流程。</p>
        </div>
        <Link href="/compare">查看比较</Link>
      </div>

      <div className="scene-tabs" aria-label="按场景筛选首页产品">
        {scenes.map((item) => (
          <button key={item} type="button" className={scene === item ? 'active' : ''} onClick={() => chooseScene(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="showcase-layout">
        <div className="showcase-list">
          {visibleProducts.map((product) => (
            <button
              key={product.slug}
              type="button"
              className={activeProduct.slug === product.slug ? 'active' : ''}
              onClick={() => {
                setActiveSlug(product.slug);
                setMessage(`正在查看「${product.name}」的前端演示信息。`);
              }}
            >
              <span>{product.scene}</span>
              <strong>{product.name}</strong>
              <small>{product.age} · {product.pieces}</small>
            </button>
          ))}
        </div>

        <article className="showcase-detail">
          <Image src={activeProduct.image} alt={activeProduct.name} width={760} height={520} priority={false} />
          <div>
            <span>{activeProduct.status}</span>
            <h3>{activeProduct.name}</h3>
            <p>{activeProduct.description}</p>
            <dl>
              <div><dt>适用年龄</dt><dd>{activeProduct.age}</dd></div>
              <div><dt>材质</dt><dd>{activeProduct.material}</dd></div>
              <div><dt>参考价格</dt><dd>{activeProduct.price}</dd></div>
            </dl>
            <div className="showcase-actions">
              <Link href={`/products/${activeProduct.slug}`}>查看详情</Link>
              <button type="button" onClick={saveFavorite}>收藏/取消收藏</button>
              <button type="button" onClick={addCompare}>加入比较</button>
            </div>
            <p className="action-message">{message}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductCatalog } from '../../../components/product-catalog';
import { products } from '../../../lib/products';

/**
 * PLP 商品列表（骨架 · ISR 示例页）：
 * - `export const revalidate = 60`：每 60s 增量再生成（ISR，SEO 答辩点）
 * - 数据接线：列表数据来自 GET /api/v1/products（lib/api.ts），
 *   API 未启动时回退到下方演示数据 —— 接线后删除 MOCK。
 * 筛选器（分类/价格/属性多维筛）由组员 A 实现。
 */
export const metadata: Metadata = {
  title: '产品系列',
  description: '浏览 WEMOVE SPORTS 木质轨道积木与亲子运动玩具。',
};

export const revalidate = 60;

export default async function ProductsPage() {
  return (
    <div className="catalog">
      <div className="catalog-heading">
        <span className="eyebrow">The active play catalog</span>
        <h1>选择下一款产品</h1>
        <p>{products.length} 款演示产品，按需求书支持分类、年龄、场景、排序与搜索。接口接入前使用原网站素材和本地演示数据。</p>
      </div>
      <Suspense fallback={<div className="empty-state">正在加载产品筛选器...</div>}>
        <ProductCatalog products={products} />
      </Suspense>
    </div>
  );
}

import Link from 'next/link';
import { ProductCard } from '../../components/product-card';
import { products } from '../../lib/products';

/**
 * 首页（骨架）：模块占位 —— 正式内容由 CmsPage.home sections 驱动（组员 A 渲染 + 组员 D 后台配置）
 * SEO：本页为全站落地页，标题/描述继承根 layout。
 */
export default function HomePage() {
  return (
    <div className="storefront-home">
      <section className="hero"><div className="hero-copy"><h1>让学习<br />变成一种游戏</h1><p>通过自由拼接的轨道与隧道，在玩乐中探索结构与物理的乐趣。</p><div><Link href="/products">探索产品系列</Link><Link href="/play-learn">了解产品特色</Link></div></div><img src="/products/cugolino.png" alt="WEMOVE 轨道积木" /></section>
      <section className="home-section"><h2>探索 WEMOVE</h2><p>以开放式搭建，陪伴孩子在游戏中建立空间感与工程思维。</p><div className="categories"><Link href="/products">WEMOVE 套装</Link><Link href="/play-learn">STEM 教育</Link><Link href="/products">搭建灵感</Link></div></section>
      <section className="home-section featured"><div className="section-title"><h2>产品系列</h2><Link href="/products">查看全部产品</Link></div><div className="product-grid">{products.map((product) => <ProductCard key={product.slug} product={product} />)}</div></section>
    </div>
  );
}

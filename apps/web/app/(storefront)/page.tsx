import Link from 'next/link';
import Image from 'next/image';
import { HomeShowcase } from '../../components/home-showcase';
import { ProductCard } from '../../components/product-card';
import { products } from '../../lib/products';

/**
 * 首页（骨架）：模块占位 —— 正式内容由 CmsPage.home sections 驱动（组员 A 渲染 + 组员 D 后台配置）
 * SEO：本页为全站落地页，标题/描述继承根 layout。
 */
export default function HomePage() {
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="storefront-home">
      <section className="hero">
        <div className="hero-copy">
          <h1>让学习<br />变成一种游戏</h1>
          <p>通过自由拼接的轨道与隧道，在玩乐中探索结构、重力、速度与空间路径的乐趣。</p>
          <div>
            <Link href="/products">探索产品系列</Link>
            <Link href="#showcase">体验动态选品</Link>
          </div>
        </div>
        <Image src="/products/hero-cover.png" alt="WEMOVE 轨道积木封面" width={1140} height={760} priority />
      </section>

      <section className="home-section">
        <h2>探索 WEMOVE</h2>
        <p>以开放式搭建为核心，把产品浏览、收藏、比较和账户入口串成完整前台流程。</p>
        <div className="categories">
          <Link href="/products"><span>产品系列</span><strong>筛选、搜索、收藏、比较</strong></Link>
          <Link href="/play-learn"><span>STEM 玩法</span><strong>展示玩法灵感与教育价值</strong></Link>
          <Link href="/customer/register"><span>账户流程</span><strong>登录注册与 18 岁确认</strong></Link>
        </div>
      </section>

      <HomeShowcase products={products} />

      <section className="home-section rhythm-section">
        <div>
          <h2>从浏览到决策的前端流程</h2>
          <p>当前使用本地数据模拟真实用户行为，等成员 B/C 接口完成后可替换为接口请求。</p>
        </div>
        <div className="flow-steps">
          <article><span>01</span><h3>浏览产品</h3><p>查看系列、年龄、玩法、材质、价格和状态。</p></article>
          <article><span>02</span><h3>收藏与对比</h3><p>用 localStorage 保存用户选择，刷新页面仍可查看。</p></article>
          <article><span>03</span><h3>账户与咨询</h3><p>完成登录注册、个人中心、联系表单等前台入口。</p></article>
        </div>
      </section>

      <section className="home-section featured">
        <div className="section-title">
          <h2>热门产品推荐</h2>
          <Link href="/products">查看全部产品</Link>
        </div>
        <div className="product-grid">{featuredProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
      </section>
    </div>
  );
}

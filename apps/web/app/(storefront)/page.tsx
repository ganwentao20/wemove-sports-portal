import Link from 'next/link';
import { HomeHeroCarousel } from '../../components/home-hero-carousel';
import { HomeShowcase } from '../../components/home-showcase';
import { ProductCard } from '../../components/product-card';
import { products } from '../../lib/products';
import { siteSections } from '../../lib/site-sections';

/**
 * 首页（骨架）：模块占位 —— 正式内容由 CmsPage.home sections 驱动（组员 A 渲染 + 组员 D 后台配置）
 * SEO：本页为全站落地页，标题/描述继承根 layout。
 */
export default function HomePage() {
  const featuredProducts = products.slice(0, 4);
  const categorySections = siteSections.filter((section) =>
    ['/products', '/stem-education', '/custom-furniture', '/pilot-production'].includes(section.href),
  );
  const contentSections = siteSections.filter((section) =>
    ['/play', '/charity', '/research', '/craft-dream'].includes(section.href),
  );

  return (
    <div className="storefront-home">
      <HomeHeroCarousel />

      <section className="home-section">
        <h2>主推产品分类</h2>
        <p>按需求书首页结构保留 3-5 个清晰分类入口，用户可以从产品、课程、定制和打样服务进入后续流程。</p>
        <div className="categories">
          {categorySections.map((section) => (
            <Link key={section.href} href={section.href}>
              <span>{section.label}</span>
              <strong>{section.bullets[0]}</strong>
            </Link>
          ))}
        </div>
      </section>

      <HomeShowcase products={products} />

      <section className="home-section featured">
        <div className="section-title">
          <h2>Featured Products</h2>
          <Link href="/products">查看全部产品</Link>
        </div>
        <div className="product-grid">{featuredProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
      </section>

      <section className="home-section play-together">
        <div className="section-title">
          <div>
            <h2>Play Together</h2>
            <p>把你的 STEM、科研、公益和匠心筑梦内容收进首页内容区，符合需求书“玩法文章、家庭活动、品牌内容”的入口要求。</p>
          </div>
          <Link href="/play">进入内容列表</Link>
        </div>
        <div className="story-grid">
          {contentSections.map((section) => (
            <Link key={section.href} href={section.href}>
              <span>{section.eyebrow}</span>
              <h3>{section.title}</h3>
              <p>{section.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section rhythm-section">
        <div>
          <h2>品牌价值</h2>
          <p>首页用事实型信息说明产品价值，不做杂乱装饰，突出运动、亲子、易用和安全。</p>
        </div>
        <div className="flow-steps">
          <article><span>01</span><h3>运动与协调</h3><p>通过搭建、滚球、观察和调整，让孩子在真实动作里理解空间与节奏。</p></article>
          <article><span>02</span><h3>亲子与课堂</h3><p>适合家庭共玩、课程活动和团队协作，内容可继续接 CMS 与活动模块。</p></article>
          <article><span>03</span><h3>资料可追溯</h3><p>产品详情、说明书、玩法指南和安全提示保留独立入口，便于后续后台维护。</p></article>
        </div>
      </section>

      <section className="home-section dealer-cta">
        <div>
          <h2>经销商入口</h2>
          <p>需求书要求首页提供 Find a Dealer 与 Become a Dealer。当前先保留经销商申请和登录入口，后续由成员 B 接经销商业务。</p>
        </div>
        <div>
          <Link href="/dealer/apply">Become a Dealer</Link>
          <Link href="/dealer/login">Dealer Login</Link>
        </div>
      </section>

      <section className="home-section quality-links">
        <div className="section-title">
          <div>
            <h2>质量与安全</h2>
            <p>链接到支持中心、下载中心和产品说明书，承接测试、材料、说明书与常见问题等信任信息。</p>
          </div>
          <Link href="/support">支持中心</Link>
        </div>
        <div className="story-grid compact">
          <Link href="/support/downloads"><span>Downloads</span><h3>电子说明书</h3><p>集中管理产品说明书、玩法指南和资料下载。</p></Link>
          <Link href="/support"><span>Support</span><h3>产品支持</h3><p>保留 FAQ、联系入口和售前售后资料位置。</p></Link>
          <Link href="/products"><span>Product Detail</span><h3>产品信息</h3><p>在产品详情页展示年龄、材质、规格、玩法与安全说明。</p></Link>
        </div>
      </section>
    </div>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ProductMediaGallery } from '../../../../components/product-media-gallery';
import { ProductActions } from '../../../../components/product-actions';
import { productBySlug, products } from '../../../../lib/products';

/** PDP 路由参数 */
interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return products.map(({ slug }) => ({ slug }));
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();
  const relatedProducts = products
    .filter((item) => item.slug !== product.slug && item.category === product.category)
    .concat(products.filter((item) => item.slug !== product.slug && item.category !== product.category))
    .slice(0, 3);
  const galleryItems = [
    { src: product.image, label: '产品主图', alt: product.name },
    { src: '/products/hero-cover.png', label: '搭建场景', alt: `${product.name} 搭建场景` },
    { src: '/products/stem-hero.png', label: '课堂应用', alt: `${product.name} 课堂应用` },
    { src: '/products/manual-guide-cover.png', label: '说明资料', alt: `${product.name} 说明资料` },
  ];
  const playSteps = [
    '先选择底座与坡道模块，搭建一条稳定的起点路径。',
    '加入转弯、落差或动力模块，观察弹珠速度和方向变化。',
    '反复调整结构，让孩子在试错中理解重力、空间路径与因果关系。',
  ];
  const safetyNotes = [
    '建议在成人陪同下使用，避免低龄儿童误吞小零件。',
    '木质模块使用前请检查边角、连接处和弹珠轨道是否完好。',
    '收纳时将弹珠、小配件与积木分区放置，保持干燥通风。',
  ];

  return (
    <main className="pdp-page">
      <nav className="pdp-breadcrumb">
        <Link href="/products">Products</Link>
        <span>/</span>
        <span>{product.categoryLabel}</span>
        <span>/</span>
        <strong>{product.name}</strong>
      </nav>

      <section className="pdp-hero">
        <ProductMediaGallery items={galleryItems} />
        <aside className="pdp-summary">
          <span className="eyebrow">{product.categoryLabel}</span>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="pdp-price-row">
            <strong>{product.price}</strong>
            <span>{product.status}</span>
          </div>
          <dl className="pdp-quick-specs">
            <div>
              <dt>SKU</dt>
              <dd>{product.slug.toUpperCase()}</dd>
            </div>
            <div>
              <dt>推荐年龄</dt>
              <dd>{product.age}</dd>
            </div>
            <div>
              <dt>使用场景</dt>
              <dd>{product.scene}</dd>
            </div>
            <div>
              <dt>套装件数</dt>
              <dd>{product.pieces}</dd>
            </div>
          </dl>
          <ProductActions product={product} />
          <small>价格、库存、购物车与订单接口后续由成员 C 接入；当前保留前端交互闭环。</small>
        </aside>
      </section>

      <section className="pdp-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">Product details</span>
            <h2>完整产品信息</h2>
          </div>
          <p>按需求书补齐可销售产品页需要展示的规格、卖点和使用说明。</p>
        </div>
        <div className="pdp-spec-grid">
          <article>
            <span>材质</span>
            <strong>{product.material}</strong>
          </article>
          <article>
            <span>尺寸</span>
            <strong>{product.size}</strong>
          </article>
          <article>
            <span>重量</span>
            <strong>{product.weight}</strong>
          </article>
          <article>
            <span>标签</span>
            <strong>{product.tags.join(' / ')}</strong>
          </article>
        </div>
      </section>

      <section className="pdp-info-grid">
        <article className="pdp-section">
          <span className="eyebrow">How to Play</span>
          <h2>怎么玩</h2>
          <ol>
            {playSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </article>
        <article className="pdp-section">
          <span className="eyebrow">Safety Notes</span>
          <h2>安全提示</h2>
          <ul>
            {safetyNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </article>
      </section>

      <section className="pdp-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">Related products</span>
            <h2>相关产品</h2>
          </div>
          <Link href="/products">查看全部产品</Link>
        </div>
        <div className="pdp-related">
          {relatedProducts.map((item) => (
            <Link key={item.slug} href={`/products/${item.slug}`}>
              <Image src={item.image} alt={item.name} width={420} height={300} />
              <span>{item.categoryLabel}</span>
              <strong>{item.name}</strong>
              <small>{item.age} · {item.price}</small>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

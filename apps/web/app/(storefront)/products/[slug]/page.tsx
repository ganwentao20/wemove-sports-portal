import Link from 'next/link';
import { notFound } from 'next/navigation';
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

  return (
    <div className="product-detail">
      <img src={product.image} alt={product.name} />
      <div>
        <nav><Link href="/products">产品系列</Link> / {product.name}</nav>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <ul>
          <li>推荐年龄：{product.age}</li>
          <li>材质：{product.material}</li>
          <li>场景：{product.scene}</li>
          <li>尺寸：{product.size}</li>
          <li>重量：{product.weight}</li>
          <li>件数：{product.pieces}</li>
          <li>参考价格：{product.price}</li>
          <li>状态：{product.status}</li>
        </ul>
        <ProductActions product={product} />
        <small>价格、库存、订单与支付会在成员 C 的接口接入后实时显示。</small>
      </div>
    </div>
  );
}

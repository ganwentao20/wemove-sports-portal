import type { Metadata } from 'next';
import { CompareClient } from '../../../components/compare-client';
import { products } from '../../../lib/products';

export const metadata: Metadata = { title: '产品比较' };

export default function ComparePage() {
  return <CompareClient products={products} />;
}

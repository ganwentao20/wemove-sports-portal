import type { Metadata } from 'next';
import { SearchClient } from '../../../components/search-client';
import { products } from '../../../lib/products';

export const metadata: Metadata = { title: '搜索' };

export default function SearchPage() {
  return <SearchClient products={products} />;
}

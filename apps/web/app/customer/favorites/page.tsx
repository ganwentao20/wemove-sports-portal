import type { Metadata } from 'next';
import { FavoritesClient } from '../../../components/favorites-client';
import { products } from '../../../lib/products';

export const metadata: Metadata = { title: '我的收藏' };

export default function FavoritesPage() {
  return <FavoritesClient products={products} />;
}

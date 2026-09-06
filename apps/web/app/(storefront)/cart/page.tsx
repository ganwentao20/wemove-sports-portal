import type { Metadata } from 'next';
import { CartClient } from '../../../components/cart-client';

export const metadata: Metadata = { title: '购物车' };

export default function CartPage() {
  return <CartClient />;
}

import { CART_KEY, readStoredList, writeStoredList } from './storefront-storage';
import { products } from './products';

export const AUTH_TOKEN_KEY = 'wemove-auth-token';
export const CUSTOMER_KEY = 'wemove-customer';
export const ADDRESSES_KEY = 'wemove-addresses';

export type Customer = {
  name: string;
  email: string;
  phone?: string;
  country?: string;
};

export type Address = {
  id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  detail: string;
  isDefault: boolean;
};

export type CartItem = {
  id: string;
  slug: string;
  kit: string;
  quantity: number;
};

const safeJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function readCustomer() {
  return safeJson<Customer | null>(CUSTOMER_KEY, null);
}

export function writeCustomer(customer: Customer) {
  window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}

export function readAddresses() {
  return safeJson<Address[]>(ADDRESSES_KEY, []);
}

export function writeAddresses(addresses: Address[]) {
  window.localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
}

export function readCartItems() {
  return readStoredList(CART_KEY).map((item, index) => {
    const [slug, kit = products.find((product) => product.slug === slug)?.pieces ?? '标准配置'] = item.split(':');
    return { id: `${item}-${index}`, slug, kit, quantity: 1 };
  });
}

export function writeCartItems(items: CartItem[]) {
  const expanded = items.flatMap((item) => Array.from({ length: item.quantity }, () => `${item.slug}:${item.kit}`));
  writeStoredList(CART_KEY, expanded);
}

export function clearAuthState() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(CUSTOMER_KEY);
}

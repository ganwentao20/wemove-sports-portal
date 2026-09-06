import { apiFetch, apiGet } from './api';
import {
  AUTH_TOKEN_KEY,
  CUSTOMER_KEY,
  readAddresses,
  readCartItems,
  readCustomer,
  writeAddresses,
  writeCartItems,
  writeCustomer,
  type Address,
  type CartItem,
  type Customer,
} from './customer-store';

type AuthResult = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: Customer;
};

const authHeaders = () => {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function loginCustomer(input: { email: string; password: string }) {
  const result = await apiFetch<AuthResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  window.localStorage.setItem(AUTH_TOKEN_KEY, result.accessToken);
  writeCustomer(result.user);
  return result.user;
}

export async function registerCustomer(input: { name: string; email: string; password: string; ageConfirmed: boolean }) {
  const result = await apiFetch<{ id: string; email: string; status: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const customer = { name: input.name, email: result.email };
  writeCustomer(customer);
  return { ...result, user: customer };
}

export async function getCurrentCustomer() {
  try {
    const user = await apiGet<Customer>('/auth/me', { headers: authHeaders() });
    writeCustomer(user);
    return { user, source: 'api' as const };
  } catch {
    return { user: readCustomer(), source: 'local' as const };
  }
}

export async function logoutCustomer() {
  try {
    await apiFetch('/auth/logout', { method: 'POST', headers: authHeaders() });
  } finally {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(CUSTOMER_KEY);
  }
}

export async function saveCustomerProfile(customer: Customer) {
  // 组长当前 API 暂未提供 PATCH /auth/me 或 /customer/profile。
  // 后续接口确定后只需替换本函数，页面不用重写。
  writeCustomer(customer);
  return customer;
}

export async function listAddresses() {
  // 预留接口：GET /customer/addresses（待成员 C/组长确认模块归属）。
  return readAddresses();
}

export async function upsertAddress(address: Address) {
  const current = readAddresses();
  const normalized = address.isDefault ? current.map((item) => ({ ...item, isDefault: false })) : current;
  const exists = normalized.some((item) => item.id === address.id);
  const next = exists ? normalized.map((item) => (item.id === address.id ? address : item)) : [...normalized, address];
  writeAddresses(next);
  return next;
}

export async function deleteAddress(id: string) {
  const next = readAddresses().filter((address) => address.id !== id);
  writeAddresses(next);
  return next;
}

export async function setDefaultAddress(id: string) {
  const next = readAddresses().map((address) => ({ ...address, isDefault: address.id === id }));
  writeAddresses(next);
  return next;
}

export async function listCart() {
  // 预留接口：GET /cart（README 标注 cart/order 为成员 C 待建）。
  return readCartItems();
}

export async function saveCart(items: CartItem[]) {
  // 预留接口：PUT /cart/items；目前本地可完整演示改量/删除/清空/结算前检查。
  writeCartItems(items);
  return items;
}

export async function clearCart() {
  window.localStorage.removeItem('wemove-cart');
}

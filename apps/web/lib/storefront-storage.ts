export const FAVORITES_KEY = 'wemove-favorites';
export const COMPARE_KEY = 'wemove-compare';
export const CART_KEY = 'wemove-cart';

export function readStoredList(key: string) {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function writeStoredList(key: string, value: string[]) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(value))));
}

export function addStoredItem(key: string, slug: string, limit?: number) {
  const current = readStoredList(key);

  if (current.includes(slug)) {
    return { next: current, added: false, reason: 'exists' as const };
  }

  if (limit && current.length >= limit) {
    return { next: current, added: false, reason: 'limit' as const };
  }

  const next = [...current, slug];
  writeStoredList(key, next);
  return { next, added: true, reason: 'added' as const };
}

export function toggleStoredItem(key: string, slug: string) {
  const current = readStoredList(key);
  const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
  writeStoredList(key, next);
  return next;
}

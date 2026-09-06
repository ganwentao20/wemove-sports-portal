export const CUSTOMER_TOKEN_KEY = "wm_customer_access_token";
export const STAFF_TOKEN_KEY = "wm_staff_access_token";

export function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

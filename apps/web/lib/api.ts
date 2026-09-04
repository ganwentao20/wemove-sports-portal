/**
 * 前台 → API 的统一访问层。
 *
 * 约定：apps/api 所有接口返回统一响应体（与仓库规范一致）：
 *   HTTP 状态码保留语义（2xx/4xx/5xx）
 *   body = { code: 0 | 业务错误码, message: string, data: T | null, traceId?: string }
 *
 * 本地开发默认走同源代理（next.config.ts rewrites /api/v1 -> apps/api:8080），
 * 部署时可用 NEXT_PUBLIC_API_BASE_URL 指向网关绝对地址。
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '/api/v1';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
  traceId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 业务调用入口：GET/POST/PUT/PATCH/DELETE 共用。
 * 401 时抛出 ApiError(401)，由调用方决定跳转登录（登录态接入后实现）。
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: init?.cache ?? 'no-store',
    next: init?.next,
  });

  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!res.ok || !body || body.code !== 0) {
    throw new ApiError(
      body?.message ?? `Request failed with HTTP ${res.status}`,
      res.status,
      body?.code ?? -1,
    );
  }
  return body.data as T;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'GET' });
}

import { ApiError, type ApiEnvelope } from "./api";

export type SessionKind = "customer" | "dealer" | "staff";

async function readEnvelope<T>(response: Response): Promise<T> {
  const body = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !body || body.code !== 0) {
    throw new ApiError(
      body?.message ?? `Request failed with HTTP ${response.status}`,
      response.status,
      body?.code ?? -1,
    );
  }
  return body.data as T;
}

function secureHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("x-wemove-csrf", "1");
  if (init?.body != null && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/** 登录响应由同源 Route Handler 处理，JWT 不会暴露给浏览器 JavaScript。 */
export async function sessionLogin<T>(
  kind: SessionKind,
  credentials: { email: string; password: string },
): Promise<T> {
  const response = await fetch(`/api/session/${kind}/login`, {
    method: "POST",
    headers: secureHeaders(),
    body: JSON.stringify(credentials),
  });
  return readEnvelope<T>(response);
}

/** 调用受保护 API；服务端从 HttpOnly Cookie 读取 JWT 并注入 Bearer 头。 */
export async function secureApiFetch<T>(
  kind: SessionKind,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!path.startsWith("/"))
    throw new Error("secure API path must start with /");
  const response = await fetch(`/api/secure/${kind}${path}`, {
    ...init,
    headers: secureHeaders(init),
    cache: init?.cache ?? "no-store",
  });
  return readEnvelope<T>(response);
}

export async function sessionLogout(kind: SessionKind): Promise<void> {
  const response = await fetch(`/api/session/${kind}/logout`, {
    method: "POST",
    headers: secureHeaders(),
  });
  await readEnvelope<unknown>(response);
}

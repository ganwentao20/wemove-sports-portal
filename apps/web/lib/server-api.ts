import "server-only";

import type { ApiEnvelope } from "./api";
import { API_ORIGIN } from "./session-server";

export type ServerApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; message: string };

/** Server Component 专用 API 读取，保留 HTTP 与统一业务错误语义。 */
export async function serverApiGet<T>(
  path: string,
): Promise<ServerApiResult<T>> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    const body = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !body || body.code !== 0 || body.data === null) {
      return {
        ok: false,
        status: response.status,
        message: body?.message ?? `Request failed with HTTP ${response.status}`,
      };
    }
    return { ok: true, data: body.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Product service is temporarily unavailable.",
    };
  }
}

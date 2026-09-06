import "server-only";

import type { NextRequest } from "next/server";

export type ServerSessionKind = "customer" | "dealer" | "staff";

export const SESSION_COOKIE: Record<ServerSessionKind, string> = {
  customer: "wm_customer_session",
  dealer: "wm_dealer_session",
  staff: "wm_staff_session",
};

export const API_ORIGIN = (
  process.env.API_PROXY_TARGET ?? "http://localhost:8080"
).replace(/\/$/, "");

export function isSessionKind(value: string): value is ServerSessionKind {
  return value === "customer" || value === "dealer" || value === "staff";
}

export function upstreamUrl(path: string, request: NextRequest): URL {
  const url = new URL(`/api/v1/${path.replace(/^\/+/, "")}`, API_ORIGIN);
  url.search = request.nextUrl.search;
  return url;
}

export function tokenMaxAge(token: string): number {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return 7200;
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      Buffer.from(normalized, "base64").toString("utf8"),
    ) as { exp?: number };
    const seconds = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
    return Math.max(1, Math.min(seconds, 8 * 60 * 60));
  } catch {
    return 7200;
  }
}

export function hasCsrfHeader(request: NextRequest): boolean {
  return request.headers.get("x-wemove-csrf") === "1";
}

export function jsonError(
  status: number,
  message: string,
  code = -1,
): Response {
  return Response.json({ code, message, data: null }, { status });
}

export async function forwardResponse(response: Response): Promise<Response> {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const traceId = response.headers.get("x-trace-id");
  if (contentType) headers.set("content-type", contentType);
  if (traceId) headers.set("x-trace-id", traceId);
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers,
  });
}

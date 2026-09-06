import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import {
  forwardResponse,
  hasCsrfHeader,
  isSessionKind,
  jsonError,
  SESSION_COOKIE,
  upstreamUrl,
} from '@/lib/session-server';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ kind: string; path: string[] }> },
) {
  const { kind, path } = await context.params;
  if (!isSessionKind(kind)) return jsonError(404, 'unknown session type');
  if (
    path.length === 0 ||
    path.some(
      (segment) =>
        !segment || segment === '.' || segment === '..' || segment.includes('/'),
    )
  ) {
    return jsonError(400, 'invalid API path');
  }
  if (MUTATING_METHODS.has(request.method) && !hasCsrfHeader(request)) {
    return jsonError(403, 'CSRF check failed');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE[kind])?.value;
  if (!token) return jsonError(401, 'sign in required', 40101);

  const headers = new Headers({
    accept: request.headers.get('accept') ?? 'application/json',
    authorization: `Bearer ${token}`,
  });
  const contentType = request.headers.get('content-type');
  const mfaCode = request.headers.get('x-mfa-code');
  if (contentType) headers.set('content-type', contentType);
  if (mfaCode) headers.set('x-mfa-code', mfaCode);

  const response = await fetch(upstreamUrl(path.join('/'), request), {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
    cache: 'no-store',
    redirect: 'manual',
  });
  return forwardResponse(response);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

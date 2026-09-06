import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import {
  API_ORIGIN,
  hasCsrfHeader,
  isSessionKind,
  jsonError,
  SESSION_COOKIE,
} from '@/lib/session-server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  const { kind } = await context.params;
  if (!isSessionKind(kind)) return jsonError(404, 'unknown session type');
  if (!hasCsrfHeader(request)) return jsonError(403, 'CSRF check failed');

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE[kind])?.value;
  if (token) {
    await fetch(`${API_ORIGIN}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      cache: 'no-store',
    }).catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE[kind]);
  return Response.json({ code: 0, message: 'ok', data: null });
}

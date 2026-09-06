import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { ApiEnvelope } from '@/lib/api';
import {
  API_ORIGIN,
  hasCsrfHeader,
  isSessionKind,
  jsonError,
  SESSION_COOKIE,
  tokenMaxAge,
} from '@/lib/session-server';

type LoginData = {
  accessToken?: string;
  expiresIn?: string | number;
  tokenType?: string;
  user?: { companyId?: string | null };
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  const { kind } = await context.params;
  if (!isSessionKind(kind)) return jsonError(404, 'unknown session type');
  if (!hasCsrfHeader(request)) return jsonError(403, 'CSRF check failed');

  const endpoint = kind === 'staff' ? 'auth/staff/login' : 'auth/login';
  const response = await fetch(`${API_ORIGIN}/api/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: await request.text(),
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as ApiEnvelope<LoginData> | null;
  if (!response.ok || !body || body.code !== 0 || !body.data?.accessToken) {
    return Response.json(
      body ?? { code: -1, message: 'Sign in failed', data: null },
      { status: response.status },
    );
  }
  if (kind === 'dealer' && !body.data.user?.companyId) {
    return jsonError(
      403,
      'This account is not linked to an approved dealer company.',
      40301,
    );
  }

  const token = body.data.accessToken;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE[kind], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: tokenMaxAge(token),
  });

  const safeData = {
    expiresIn: body.data.expiresIn,
    tokenType: body.data.tokenType,
    user: body.data.user,
  };
  return Response.json({ ...body, data: safeData }, { status: response.status });
}

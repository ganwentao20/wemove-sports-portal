import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { ApiEnvelope } from "@/lib/api";
import {
  API_ORIGIN,
  hasCsrfHeader,
  isSessionKind,
  jsonError,
  SESSION_COOKIE,
  tokenMaxAge,
} from "@/lib/session-server";

type LoginData = {
  accessToken?: string;
  expiresIn?: string | number;
  tokenType?: string;
  sessionKind?: string;
  user?: { kind?: string; companyId?: string | null };
  mfaRequired?: boolean;
  enrollmentRequired?: boolean;
  challengeToken?: string;
  secret?: string;
  otpauthUrl?: string;
};

export async function POST(request: NextRequest) {
  if (!hasCsrfHeader(request)) return jsonError(403, "CSRF check failed");
  const credentials = await request.json().catch(() => null);
  if (
    !credentials ||
    typeof credentials !== "object" ||
    Array.isArray(credentials)
  )
    return jsonError(400, "Invalid credentials");

  // A new sign-in replaces the previous identity, including during MFA.
  const jar = await cookies();
  for (const name of Object.values(SESSION_COOKIE)) jar.delete(name);
  const verifyingStaff = typeof credentials.challengeToken === "string";
  let response: Response;
  try {
    response = await fetch(
      `${API_ORIGIN}/api/v1/auth/${verifyingStaff ? "staff/mfa" : "unified/login"}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": request.headers.get("user-agent") ?? "Web session",
        },
        body: JSON.stringify(credentials),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    return jsonError(
      503,
      "Sign-in is temporarily unavailable. Please try again.",
    );
  }
  const body = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<LoginData> | null;
  if (!response.ok || !body || body.code !== 0) {
    return Response.json(
      body
        ? { ...body, data: null }
        : { code: -1, message: "Sign in failed", data: null },
      {
        status: response.ok ? 502 : response.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  const data = body.data;
  const kind = verifyingStaff ? "staff" : data?.sessionKind;
  if (!kind || !isSessionKind(kind))
    return jsonError(502, "Invalid sign-in response");
  if (
    kind === "staff" &&
    data?.mfaRequired &&
    !data.accessToken &&
    data.challengeToken
  ) {
    return Response.json(
      {
        ...body,
        data: {
          sessionKind: "staff",
          mfaRequired: true,
          enrollmentRequired: data.enrollmentRequired === true,
          challengeToken: data.challengeToken,
          ...(data.secret
            ? { secret: data.secret, otpauthUrl: data.otpauthUrl }
            : {}),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    !data?.accessToken ||
    !data.user ||
    (kind === "staff" && data.user.kind !== "staff") ||
    (kind !== "staff" && data.user.kind !== "customer") ||
    (kind === "dealer" && !data.user.companyId)
  )
    return jsonError(502, "Invalid sign-in response");

  jar.set(SESSION_COOKIE[kind], data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: tokenMaxAge(data.accessToken),
  });
  return Response.json(
    {
      ...body,
      data: {
        sessionKind: kind,
        user: data.user,
        expiresIn: data.expiresIn,
        tokenType: data.tokenType,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { LANGUAGE_PREFIX } from "./language-code";
import { safeRedirect } from "./safe-redirect";
import type { SessionKind } from "./secure-api";

type LoginIdentity = {
  sessionKind: SessionKind;
  user?: {
    mfaRequired?: boolean;
    mfaEnabled?: boolean;
    dealerTermsRequired?: boolean;
  };
};

/** Continue only within the authenticated identity's area of the site. */
export function loginDestination(
  identity: LoginIdentity,
  requested?: string | null,
) {
  const { sessionKind: kind, user } = identity;
  if (kind === "dealer" && user?.mfaRequired && !user.mfaEnabled)
    return "/dealer/security";
  if (kind === "dealer" && user?.dealerTermsRequired) return "/dealer/terms";
  const fallback =
    kind === "staff"
      ? "/admin/dashboard"
      : kind === "dealer"
        ? "/dealer/catalog"
        : "/customer/account";
  const destination = safeRedirect(requested, fallback);
  try {
    const url = new URL(destination, "https://wemove.invalid");
    const decoded = decodeURIComponent(url.pathname);
    // Encoded separators and repeated encoding must not disguise another portal.
    if (/[\\%\u0000-\u001f\u007f]/.test(decoded) || decoded.includes("//"))
      return fallback;
    const path =
      new URL(decoded, "https://wemove.invalid").pathname.replace(
        LANGUAGE_PREFIX,
        "",
      ) || "/";
    if (/^\/(?:api|login)(?:\/|$)/.test(path) || /\/login\/?$/.test(path))
      return fallback;
    if (kind === "staff" && !/^\/admin(?:\/|$)/.test(path)) return fallback;
    if (kind === "dealer" && !/^\/dealer(?:\/|$)/.test(path)) return fallback;
    if (kind === "customer" && /^\/(?:admin|dealer)(?:\/|$)/.test(path))
      return fallback;
    return destination;
  } catch {
    return fallback;
  }
}

export function unifiedLoginUrl(requested?: string | null) {
  const next = safeRedirect(requested, "");
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

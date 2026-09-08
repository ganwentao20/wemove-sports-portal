/** Only root-relative same-origin destinations are accepted after authentication. */
export function safeRedirect(
  requested: string | null | undefined,
  fallback: string,
): string {
  if (!requested || !requested.startsWith("/") || requested.startsWith("//"))
    return fallback;
  try {
    const decoded = decodeURIComponent(requested);
    if (
      /[\\\u0000-\u001f\u007f]/.test(requested) ||
      /[\\\u0000-\u001f\u007f]/.test(decoded)
    )
      return fallback;
    const base = "https://wemove.invalid";
    const url = new URL(requested, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

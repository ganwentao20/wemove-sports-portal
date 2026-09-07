export const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
export const LANGUAGE_PREFIX =
  /^\/(?!api(?=\/|$))([a-z]{2,3}(?:-[A-Z]{2})?)(?=\/|$)/;
export function languageName(code: string) {
  if (code === "en") return "English";
  if (code === "zh") return "中文";
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

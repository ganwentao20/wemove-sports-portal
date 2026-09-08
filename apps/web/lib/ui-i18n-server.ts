import "server-only";
import { getLocale } from "./locale";
import { translateUi, type UiValues } from "./ui-i18n";
export { getLocale as getUiLocale } from "./locale";

export async function getUiText() {
  const locale = await getLocale();
  return (text: string, values?: UiValues) => translateUi(locale, text, values);
}

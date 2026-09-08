import { getUiText } from "../../../lib/ui-i18n-server";
import { Checkout } from "../checkout/checkout";
export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Shopping cart") };
}
export default function Page() {
  return <Checkout />;
}

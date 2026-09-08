import { getUiText } from "../../../lib/ui-i18n-server";
import { Checkout } from "./checkout";
export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Checkout") };
}
export default function Page() {
  return <Checkout />;
}

import { getUiText } from "../../../lib/ui-i18n-server";
import { PricingWorkbench } from "./pricing-workbench";
export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Prices & markets"),
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  return <PricingWorkbench />;
}

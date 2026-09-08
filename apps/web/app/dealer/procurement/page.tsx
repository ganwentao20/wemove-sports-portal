import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { B2bWorkbench } from "../../../components/b2b-workbench";
export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Quotes & Purchase Orders | WEMOVE"),
    robots: { index: false, follow: false },
  };
}
export default function ProcurementPage() {
  return <B2bWorkbench />;
}

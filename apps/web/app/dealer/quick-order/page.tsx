import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { QuickOrderWorkbench } from "./quick-order-workbench";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Quick Order | WEMOVE Dealer"),
    robots: { index: false, follow: false },
  };
}

export default function QuickOrderPage() {
  return <QuickOrderWorkbench />;
}

import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { DealerCatalog } from "./dealer-catalog";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Dealer Catalog | WEMOVE"),
    robots: { index: false, follow: false },
  };
}

export default function DealerCatalogPage() {
  return <DealerCatalog />;
}

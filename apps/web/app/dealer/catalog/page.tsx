import type { Metadata } from "next";
import { DealerCatalog } from "./dealer-catalog";

export const metadata: Metadata = {
  title: "Dealer Catalog | WEMOVE",
  robots: { index: false, follow: false },
};

export default function DealerCatalogPage() {
  return <DealerCatalog />;
}

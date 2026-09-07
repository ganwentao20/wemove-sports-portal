import type { Metadata } from "next";
import { ProductWorkbench } from "./product-workbench";
import { ProductMerchandising } from "./product-merchandising";

export const metadata: Metadata = {
  title: "Products | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function AdminProductsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <ProductWorkbench />
      <ProductMerchandising />
    </main>
  );
}

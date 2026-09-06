import type { Metadata } from "next";
import { ProductWorkbench } from "./product-workbench";

export const metadata: Metadata = {
  title: "Products | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function AdminProductsPage() {
  return <ProductWorkbench />;
}

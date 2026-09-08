import { getUiText } from "../../../lib/ui-i18n-server";
import { ProductWorkbench } from "./product-workbench";
import { ProductMerchandising } from "./product-merchandising";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Products | WEMOVE Admin"),
    robots: { index: false, follow: false },
  };
}

export default function AdminProductsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <ProductWorkbench />
      <ProductMerchandising />
    </main>
  );
}

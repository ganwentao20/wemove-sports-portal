import { getUiText } from "../../../lib/ui-i18n-server";
import { OrderWorkbench } from "./order-workbench";
import { ManualOrder } from "./manual-order";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Orders | WEMOVE Admin"),
    robots: { index: false, follow: false },
  };
}

export default function AdminOrdersPage() {
  return (
    <>
      <OrderWorkbench />
      <ManualOrder />
    </>
  );
}

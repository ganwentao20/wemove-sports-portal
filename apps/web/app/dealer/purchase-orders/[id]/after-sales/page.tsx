import { PurchaseOrderAfterSales } from "../../../../../components/po-after-sales";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseOrderAfterSales orderId={id} />;
}

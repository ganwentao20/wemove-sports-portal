import { RetailOrder } from "../../../../components/retail-order";
export const metadata = { title: "Order operations" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RetailOrder id={id} admin />;
}

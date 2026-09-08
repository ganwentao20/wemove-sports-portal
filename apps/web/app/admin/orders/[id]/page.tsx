import { getUiText } from "../../../../lib/ui-i18n-server";
import { RetailOrder } from "../../../../components/retail-order";
export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Order operations") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RetailOrder id={id} admin />;
}

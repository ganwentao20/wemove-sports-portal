import { notFound, redirect } from "next/navigation";
import { getLocale, getMarket } from "../../../../lib/locale";
import { publicUrl } from "../../../../lib/public-url";

const LEGACY_PRODUCTS: Record<string, string> = {
  "20": "standard-50",
  "14": "cugolino-basic",
  "15": "large-pendulum-set",
  "16": "small-turntable-set",
  "17": "elevator",
  "18": "magnetic-cannon",
  "19": "snake-track-set",
};

export default async function LegacyProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slug = LEGACY_PRODUCTS[id];
  if (!slug) notFound();
  const [locale, market] = await Promise.all([getLocale(), getMarket()]);
  redirect(publicUrl(`/products/${slug}`, locale, market));
}

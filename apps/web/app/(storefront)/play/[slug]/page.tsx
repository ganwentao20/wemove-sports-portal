import { redirect } from "next/navigation";
import { getLocale, getMarket } from "../../../../lib/locale";
import { publicUrl } from "../../../../lib/public-url";

export default async function PlayArticleAlias({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, locale, market] = await Promise.all([
    params,
    getLocale(),
    getMarket(),
  ]);
  redirect(publicUrl(`/content/${encodeURIComponent(slug)}`, locale, market));
}

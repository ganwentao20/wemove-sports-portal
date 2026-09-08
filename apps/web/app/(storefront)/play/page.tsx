import { redirect } from "next/navigation";
import { getLocale, getMarket } from "../../../lib/locale";
import { publicUrl } from "../../../lib/public-url";

export default async function PlayAlias() {
  const locale = await getLocale();
  const market = await getMarket();
  redirect(publicUrl("/play-learn", locale, market));
}

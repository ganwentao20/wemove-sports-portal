import { redirect } from "next/navigation";
import { getLocale, getMarket } from "../../../lib/locale";
export default async function Page() {
  redirect(
    `/${await getLocale()}/products?sort=newest&market=${await getMarket()}`,
  );
}

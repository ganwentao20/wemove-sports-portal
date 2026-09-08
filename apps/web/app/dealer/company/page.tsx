import { getUiText } from "../../../lib/ui-i18n-server";
import { CompanyWorkbench } from "./workbench";
export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Company, team & addresses"),
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  return <CompanyWorkbench />;
}

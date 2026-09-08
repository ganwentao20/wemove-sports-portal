import { getUiText } from "../../../lib/ui-i18n-server";
import { B2bWorkbench } from "../../../components/b2b-workbench";
export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("B2B Sales | WEMOVE Admin"),
    robots: { index: false, follow: false },
  };
}
export default function AdminB2bPage() {
  return <B2bWorkbench admin />;
}

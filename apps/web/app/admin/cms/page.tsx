import { getUiText } from "../../../lib/ui-i18n-server";
import { CmsWorkbench } from "./cms-workbench";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("CMS Pages | WEMOVE Admin"),
    robots: { index: false, follow: false },
  };
}

export default function AdminCmsPage() {
  return <CmsWorkbench />;
}

import { getUiText } from "../../../lib/ui-i18n-server";
import { MediaWorkbench } from "./media-workbench";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Media | WEMOVE Admin"),
    robots: { index: false, follow: false },
  };
}

export default function AdminMediaPage() {
  return <MediaWorkbench />;
}

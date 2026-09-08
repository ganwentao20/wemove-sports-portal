import { getUiText } from "../../../lib/ui-i18n-server";
import { PlatformWorkbench } from "../../../components/platform-workbench";
export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Site settings"), robots: { index: false } };
}
export default function Page() {
  return <PlatformWorkbench section="settings" />;
}

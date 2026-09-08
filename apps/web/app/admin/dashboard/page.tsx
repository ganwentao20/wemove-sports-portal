import { getUiText } from "../../../lib/ui-i18n-server";
import { DashboardWorkbench } from "./dashboard-workbench";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Admin Dashboard"),
    robots: { index: false, follow: false },
  };
}

export default function AdminDashboardPage() {
  return <DashboardWorkbench />;
}

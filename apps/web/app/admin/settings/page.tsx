import { PlatformWorkbench } from "../../../components/platform-workbench";
export const metadata = { title: "Site settings", robots: { index: false } };
export default function Page() {
  return <PlatformWorkbench section="settings" />;
}

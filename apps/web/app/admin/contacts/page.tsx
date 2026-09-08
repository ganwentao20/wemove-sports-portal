import { getUiText } from "../../../lib/ui-i18n-server";
import { ContactWorkbench } from "./contact-workbench";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Contact Inbox | WEMOVE Admin"),
    robots: { index: false, follow: false },
  };
}

export default function AdminContactsPage() {
  return <ContactWorkbench />;
}

import type { Metadata } from "next";
import { ContactWorkbench } from "./contact-workbench";

export const metadata: Metadata = {
  title: "Contact Inbox | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function AdminContactsPage() {
  return <ContactWorkbench />;
}

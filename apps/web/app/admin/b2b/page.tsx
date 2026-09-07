import type { Metadata } from "next";
import { B2bWorkbench } from "../../../components/b2b-workbench";
export const metadata: Metadata = {
  title: "B2B Sales | WEMOVE Admin",
  robots: { index: false, follow: false },
};
export default function AdminB2bPage() {
  return <B2bWorkbench admin />;
}

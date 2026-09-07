import type { Metadata } from "next";
import { B2bWorkbench } from "../../../components/b2b-workbench";
export const metadata: Metadata = {
  title: "Quotes & Purchase Orders | WEMOVE",
  robots: { index: false, follow: false },
};
export default function ProcurementPage() {
  return <B2bWorkbench />;
}

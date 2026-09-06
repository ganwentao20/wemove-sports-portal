import type { Metadata } from "next";
import { QuickOrderWorkbench } from "./quick-order-workbench";

export const metadata: Metadata = {
  title: "Quick Order | WEMOVE Dealer",
  robots: { index: false, follow: false },
};

export default function QuickOrderPage() {
  return <QuickOrderWorkbench />;
}

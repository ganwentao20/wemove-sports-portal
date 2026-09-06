import type { Metadata } from "next";
import { OrderWorkbench } from "./order-workbench";

export const metadata: Metadata = {
  title: "Orders | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function AdminOrdersPage() {
  return <OrderWorkbench />;
}

import type { Metadata } from "next";
import { OrderWorkbench } from "./order-workbench";
import { ManualOrder } from "./manual-order";

export const metadata: Metadata = {
  title: "Orders | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function AdminOrdersPage() {
  return (
    <>
      <OrderWorkbench />
      <ManualOrder />
    </>
  );
}

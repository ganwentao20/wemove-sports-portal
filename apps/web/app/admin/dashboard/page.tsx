import type { Metadata } from "next";
import { DashboardWorkbench } from "./dashboard-workbench";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return <DashboardWorkbench />;
}

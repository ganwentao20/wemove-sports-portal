import type { Metadata } from "next";
import { DealerReviewWorkbench } from "./dealer-review-workbench";

export const metadata: Metadata = {
  title: "Dealer Applications | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function DealerApplicationsPage() {
  return <DealerReviewWorkbench />;
}

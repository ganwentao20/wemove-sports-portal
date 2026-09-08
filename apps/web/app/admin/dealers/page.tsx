import { getUiText } from "../../../lib/ui-i18n-server";
import { DealerReviewWorkbench } from "./dealer-review-workbench";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Dealer Applications | WEMOVE Admin"),
    robots: { index: false, follow: false },
  };
}

export default function DealerApplicationsPage() {
  return <DealerReviewWorkbench />;
}

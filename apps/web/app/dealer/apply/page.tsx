import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";

import { DealerApplicationForm } from "./dealer-application-form";

export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Dealer Application") };
}

/** 经销商资质在线申请：分步填写、确认后提交到真实申请接口。 */
export default function DealerApplyPage() {
  return <DealerApplicationForm />;
}

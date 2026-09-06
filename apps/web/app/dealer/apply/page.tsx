import type { Metadata } from "next";

import { DealerApplicationForm } from "./dealer-application-form";

export const metadata: Metadata = { title: "Dealer Application" };

/** 经销商资质在线申请：分步填写、确认后提交到真实申请接口。 */
export default function DealerApplyPage() {
  return <DealerApplicationForm />;
}

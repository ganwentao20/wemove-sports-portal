import { getUiText } from "../../../../lib/ui-i18n-server";
import { CompanyWorkbench } from "../../../dealer/company/workbench";
export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Manage dealer company"),
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const t = await getUiText();

  const { id } = await searchParams;
  return id ? (
    <CompanyWorkbench admin companyId={id} />
  ) : (
    <main id="main-content" tabIndex={-1} className="p-8">
      {t("Select a company from the B2B workbench.")}
    </main>
  );
}

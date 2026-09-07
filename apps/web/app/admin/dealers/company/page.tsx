import { CompanyWorkbench } from "../../../dealer/company/workbench";
export const metadata = {
  title: "Manage dealer company",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return id ? (
    <CompanyWorkbench admin companyId={id} />
  ) : (
    <main id="main-content" tabIndex={-1} className="p-8">
      Select a company from the B2B workbench.
    </main>
  );
}

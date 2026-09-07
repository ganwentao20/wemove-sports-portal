import { CompanyWorkbench } from "./workbench";
export const metadata = {
  title: "Company, team & addresses",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <CompanyWorkbench />;
}

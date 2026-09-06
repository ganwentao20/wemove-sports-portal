import type { Metadata } from "next";
import { CmsWorkbench } from "./cms-workbench";

export const metadata: Metadata = {
  title: "CMS Pages | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function AdminCmsPage() {
  return <CmsWorkbench />;
}

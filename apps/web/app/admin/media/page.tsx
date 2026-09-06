import type { Metadata } from "next";
import { MediaWorkbench } from "./media-workbench";

export const metadata: Metadata = {
  title: "Media | WEMOVE Admin",
  robots: { index: false, follow: false },
};

export default function AdminMediaPage() {
  return <MediaWorkbench />;
}

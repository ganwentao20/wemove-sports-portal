import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { CustomerAccount } from "./customer-account";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("My Account"),
    robots: { index: false, follow: false },
  };
}

export default function AccountPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <CustomerAccount />
    </main>
  );
}

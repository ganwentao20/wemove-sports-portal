import type { Metadata } from "next";
import { CustomerAccount } from "./customer-account";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <CustomerAccount />
    </main>
  );
}

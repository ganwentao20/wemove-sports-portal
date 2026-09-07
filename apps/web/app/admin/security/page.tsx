import { AccountSecurity } from "../../../components/account-security";
import Link from "next/link";
export default function SecurityPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-8"
    >
      <Link href="/admin/dashboard" className="underline">
        Administration
      </Link>
      <h1 className="mt-4 text-3xl font-bold">My security</h1>
      <AccountSecurity kind="staff" mfaEnabled />
    </main>
  );
}

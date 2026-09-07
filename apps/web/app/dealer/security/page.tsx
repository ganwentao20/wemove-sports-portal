import { AccountSecurity } from "../../../components/account-security";
import Link from "next/link";
export default function DealerSecurityPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-8"
    >
      <Link href="/dealer/dashboard" className="underline">
        Dealer workspace
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Account security</h1>
      <p className="mt-3">
        If your company requires an authenticator, enable it here and sign in
        again before purchasing or accessing private dealer resources.
      </p>
      <AccountSecurity kind="dealer" />
    </main>
  );
}

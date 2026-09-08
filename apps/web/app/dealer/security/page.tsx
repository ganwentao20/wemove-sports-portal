import { getUiText } from "../../../lib/ui-i18n-server";
import { AccountSecurity } from "../../../components/account-security";
import Link from "next/link";
export default async function DealerSecurityPage() {
  const t = await getUiText();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-8"
    >
      <Link href="/dealer/dashboard" className="underline">
        {t("Dealer workspace")}
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{t("Account security")}</h1>
      <p className="mt-3">
        {t(
          "If your company requires an authenticator, enable it here and sign in again before purchasing or accessing private dealer resources.",
        )}
      </p>
      <AccountSecurity kind="dealer" />
    </main>
  );
}

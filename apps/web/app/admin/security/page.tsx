import { getUiText } from "../../../lib/ui-i18n-server";
import { AccountSecurity } from "../../../components/account-security";
import Link from "next/link";
export default async function SecurityPage() {
  const t = await getUiText();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-8"
    >
      <Link href="/admin/dashboard" className="underline">
        {t("Administration")}
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{t("My security")}</h1>
      <AccountSecurity kind="staff" mfaEnabled />
    </main>
  );
}

import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { CustomerRegisterForm } from "./customer-register-form";

export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Create account") };
}

export default async function RegisterPage() {
  const t = await getUiText();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4"
    >
      <h1 className="text-3xl font-bold">{t("Create account")}</h1>
      <p className="mt-1 text-sm text-neutral-700">
        {t("For personal shopping and order tracking.")}
      </p>
      <CustomerRegisterForm />
      <p className="mt-4 text-center text-sm text-neutral-700">
        {t("WEMOVE toys are for kids — accounts are for adults only.")}
      </p>
    </main>
  );
}

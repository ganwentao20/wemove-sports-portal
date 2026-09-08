import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Forgot password") };
}

export default async function ForgotPasswordPage() {
  const t = await getUiText();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t("Reset your password")}</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {t(
          "Enter your email and we will send instructions if an eligible account exists.",
        )}
      </p>
      <ForgotPasswordForm />
    </div>
  );
}

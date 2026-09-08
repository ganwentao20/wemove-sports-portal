import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Choose a new password") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getUiText();
  const { token = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t("Choose a new password")}</h1>
      <ResetPasswordForm token={token} />
    </div>
  );
}

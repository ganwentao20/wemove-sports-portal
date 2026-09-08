import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { VerifyEmailForm } from "./verify-email-form";

export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Verify email") };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getUiText();
  const { token = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t("Verify your email")}</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {t("Complete the one-time verification before signing in.")}
      </p>
      <VerifyEmailForm token={token} />
    </div>
  );
}

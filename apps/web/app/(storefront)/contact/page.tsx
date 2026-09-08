import { getUiText } from "../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Contact Us") };
}

export default async function ContactPage() {
  const t = await getUiText();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("Contact Us")}</h1>
      <p className="mt-2 text-neutral-600">
        {t("We reply within 2 business days.")}
      </p>
      <ContactForm />
    </div>
  );
}

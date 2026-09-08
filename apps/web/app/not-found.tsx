"use client";
import Link from "next/link";
import { useEffect } from "react";
import { recordEvent } from "../components/consent-analytics";
import { useUiText } from "../components/ui-locale";
import { LanguagePicker } from "../components/language-picker";
export default function NotFound() {
  const t = useUiText();
  useEffect(() => recordEvent("page_404"), []);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-20"
    >
      <div className="mb-6">
        <LanguagePicker />
      </div>
      <h1 className="text-4xl font-bold">{t("Page not found")}</h1>
      <p className="my-6">
        {t("This page may have moved or is no longer published.")}
      </p>
      <div className="flex gap-5">
        <Link href="/products" className="underline">
          {t("Browse products")}
        </Link>
        <Link href="/search" className="underline">
          {t("Search the site")}
        </Link>
        <Link href="/contact" className="underline">
          {t("Contact support")}
        </Link>
      </div>
    </main>
  );
}

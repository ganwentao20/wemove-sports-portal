"use client";
import { useEffect } from "react";
import Link from "next/link";
import { recordEvent } from "../components/consent-analytics";
import { useUiText } from "../components/ui-locale";
import { LanguagePicker } from "../components/language-picker";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useUiText();
  useEffect(() => {
    recordEvent("client_error", {
      source: "route",
      error_code: error.digest ?? "UNEXPECTED",
    });
  }, [error.digest]);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-2xl px-4 py-20"
    >
      <div className="mb-6">
        <LanguagePicker />
      </div>
      <h1 className="text-3xl font-bold">
        {t("This page could not be loaded")}
      </h1>
      <p className="my-6">
        {t(
          "Please try again. If the problem continues, contact support and include the reference below.",
        )}
      </p>
      {error.digest && (
        <p className="mb-5 text-sm">
          {t("Reference")}: {error.digest}
        </p>
      )}
      <div className="flex gap-5">
        <button className="rounded border px-5 py-3" onClick={reset}>
          {t("Try again")}
        </button>
        <Link className="rounded border px-5 py-3" href="/support">
          {t("Contact support")}
        </Link>
      </div>
    </main>
  );
}

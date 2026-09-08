import { getUiText } from "../../../../lib/ui-i18n-server";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getUiText();
  return {
    title: t("Application submitted"),
    robots: { index: false, follow: false },
  };
}

type SuccessPageProps = {
  searchParams: Promise<{ id?: string; status?: string }>;
};

export default async function DealerApplicationSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const t = await getUiText();

  const { id, status } = await searchParams;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12"
    >
      <section className="w-full rounded-2xl border border-neutral-200 bg-white p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2B5F8A]">
          {t("Application received")}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {t("Thank you for applying")}
        </h1>
        <p className="mt-4 text-neutral-600">
          {t(
            "Your dealer application has entered administrator review. Please keep the reference number below for support enquiries.",
          )}
        </p>

        <dl className="mt-7 rounded-xl bg-[#F0F5FA] p-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("Reference number")}
            </dt>
            <dd className="mt-1 break-all font-mono text-sm text-neutral-900">
              {id || t("Unavailable")}
            </dd>
          </div>
          <div className="mt-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("Current status")}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-[#2B5F8A]">
              {t(status || "PENDING_REVIEW")}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-sm text-neutral-600">
          {t(
            "Check the email provided in the application for your confirmation and secure claim link. Register and verify that email, then claim the application to receive review updates and submit corrections.",
          )}
        </p>
        <Link
          href={`/dealer/application?application=${encodeURIComponent(id ?? "")}`}
          className="mt-5 inline-block underline"
        >
          {t("Track or claim this application")}
        </Link>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-[#2B5F8A] px-5 py-2.5 font-semibold text-white hover:bg-[#204b70]"
        >
          {t("Return to home")}
        </Link>
      </section>
    </main>
  );
}

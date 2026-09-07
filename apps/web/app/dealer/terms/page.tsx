"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";
import { useHydrated } from "../../../lib/use-hydrated";
type Terms = {
  version: string;
  title: string;
  companyName: string;
  accepted: boolean;
  acceptedAt: string | null;
  mfaRequired: boolean;
  mfaEnabled: boolean;
  sections: Array<{ title: string; text: string }>;
};
export default function DealerTermsPage() {
  const ready = useHydrated(),
    [terms, setTerms] = useState<Terms | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void secureApiFetch<Terms>("dealer", "/dealer/terms")
      .then(setTerms)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Unable to load dealer terms.",
        ),
      );
  }, []);
  const destination =
    terms?.mfaRequired && !terms.mfaEnabled
      ? "/dealer/security"
      : "/dealer/catalog";
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-12"
    >
      <h1 className="text-3xl font-bold">
        {terms?.title ?? "Dealer portal terms"}
      </h1>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-300 p-3 text-red-700"
        >
          {error}
        </p>
      )}
      {terms ? (
        <>
          <p className="mt-4">
            Company: <strong>{terms.companyName}</strong>
          </p>
          <p className="mt-2 text-sm text-neutral-700">
            Version {terms.version}. Review these terms before using company
            prices, orders and private dealer resources.
          </p>
          <div className="my-8 space-y-6">
            {terms.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p className="mt-3 leading-7">{section.text}</p>
              </section>
            ))}
          </div>
          <p className="mb-6">
            <Link className="underline" href="/privacy">
              Privacy policy
            </Link>{" "}
            ·{" "}
            <Link className="underline" href="/terms">
              Website terms
            </Link>{" "}
            ·{" "}
            <Link className="underline" href="/contact">
              Contact support
            </Link>
          </p>
          {terms.accepted ? (
            <div>
              <p role="status">
                Accepted on {new Date(terms.acceptedAt!).toLocaleString()}.
              </p>
              <Link
                href={destination}
                className="mt-4 inline-block rounded border px-5 py-3"
              >
                Continue to dealer portal
              </Link>
            </div>
          ) : (
            <form
              method="POST"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await secureApiFetch("dealer", "/dealer/terms", {
                    method: "POST",
                    body: JSON.stringify({
                      version: terms.version,
                      accepted: true,
                    }),
                  });
                  window.location.assign(destination);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Unable to save acceptance.",
                  );
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={!ready || busy}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    required
                    name="accepted"
                    className="mt-1"
                  />
                  <span>
                    I have read version {terms.version}, am authorized to use
                    this company account, and accept these dealer portal terms.
                  </span>
                </label>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="rounded bg-[var(--wm-primary)] px-5 py-3 font-semibold text-white">
                    Accept and continue
                  </button>
                  <button
                    type="button"
                    className="rounded border px-5 py-3"
                    onClick={async () => {
                      await sessionLogout("dealer");
                      window.location.assign("/dealer/login");
                    }}
                  >
                    Decline and sign out
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      ) : (
        <p role="status" className="mt-6">
          Loading the current terms…
        </p>
      )}
    </main>
  );
}

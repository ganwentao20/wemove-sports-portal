"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { secureApiFetch } from "../../../lib/secure-api";
import { DealerApplicationForm } from "../apply/dealer-application-form";
type Application = {
  id: string;
  status: string;
  remark: string;
  companyName: string;
  legalRegNo: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  country: string;
  businessType: string;
};
export default function ApplicationPage() {
  const [id, setId] = useState("");
  const [token, setToken] = useState("");
  const [application, setApplication] = useState<Application | null>(null);
  const [list, setList] = useState<Array<Application>>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setId(new URLSearchParams(location.search).get("application") ?? "");
    setToken(new URLSearchParams(location.hash.slice(1)).get("claim") ?? "");
    void secureApiFetch<Application[]>("customer", "/dealer/applications")
      .then(setList)
      .catch((e) => setError(e.message));
  }, []);
  async function find(claim = false) {
    setBusy(true);
    setError("");
    try {
      const result = await secureApiFetch<Application>(
        "customer",
        `/dealer/applications/${id}${claim ? "/claim" : ""}`,
        claim ? { method: "POST", body: JSON.stringify({ token }) } : undefined,
      );
      setApplication(result);
      setToken("");
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-4xl px-4 py-10"
    >
      <h1 className="text-3xl font-bold">Track your dealer application</h1>
      <p className="my-3">
        Sign in with the verified customer email used on the application.{" "}
        <Link href="/customer/login" className="underline">
          Customer login
        </Link>
      </p>
      <p role="alert">{error}</p>
      <p role="status">{notice}</p>
      <form
        className="my-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void find(Boolean(token));
        }}
      >
        <label className="block">
          Application ID
          <input
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="ml-3 rounded border p-2"
          />
        </label>
        <label className="block">
          Email claim token (first claim only)
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="ml-3 rounded border p-2"
          />
        </label>
        <button
          disabled={busy}
          className="rounded bg-neutral-900 px-5 py-2 text-white"
        >
          {token ? "Claim and view" : "View application"}
        </button>
        <button
          type="button"
          disabled={busy || !id}
          className="ml-3 rounded border px-5 py-2"
          onClick={async () => {
            setBusy(true);
            setError("");
            setNotice("");
            try {
              await secureApiFetch(
                "customer",
                `/dealer/applications/${encodeURIComponent(id)}/claim-link`,
                { method: "POST" },
              );
              setNotice(
                "If this unclaimed application belongs to your verified email, a claim link will be sent. Allow one minute between requests.",
              );
            } catch (cause) {
              setError((cause as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Resend claim email
        </button>
      </form>
      {list.map((a) => (
        <button
          key={a.id}
          onClick={() => setId(a.id)}
          className="my-2 block underline"
        >
          {a.companyName} · {a.status} · {a.id}
        </button>
      ))}
      {application && (
        <section className="mt-6 rounded border p-5">
          <h2>
            {application.companyName} · {application.status}
          </h2>
          <p className="mt-2">
            Review message: {application.remark ?? "Review is pending."}
          </p>
          {application.status === "MORE_INFO_REQUIRED" && (
            <DealerApplicationForm
              key={application.id}
              applicationId={application.id}
              initialFields={application}
            />
          )}
        </section>
      )}
    </main>
  );
}

"use client";
import { useEffect } from "react";
import Link from "next/link";
import { recordEvent } from "../components/consent-analytics";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      <h1 className="text-3xl font-bold">This page could not be loaded</h1>
      <p className="my-6">
        Please try again. If the problem continues, contact support and include
        the reference below.
      </p>
      {error.digest && (
        <p className="mb-5 text-sm">Reference: {error.digest}</p>
      )}
      <div className="flex gap-5">
        <button className="rounded border px-5 py-3" onClick={reset}>
          Try again
        </button>
        <Link className="rounded border px-5 py-3" href="/support">
          Contact support
        </Link>
      </div>
    </main>
  );
}

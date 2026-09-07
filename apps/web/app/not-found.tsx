"use client";
import Link from "next/link";
import { useEffect } from "react";
import { recordEvent } from "../components/consent-analytics";
export default function NotFound() {
  useEffect(() => recordEvent("page_404"), []);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-20"
    >
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="my-6">
        This page may have moved or is no longer published.
      </p>
      <div className="flex gap-5">
        <Link href="/products" className="underline">
          Browse products
        </Link>
        <Link href="/search" className="underline">
          Search the site
        </Link>
        <Link href="/contact" className="underline">
          Contact support
        </Link>
      </div>
    </main>
  );
}

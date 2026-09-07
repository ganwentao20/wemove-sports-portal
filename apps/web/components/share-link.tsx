"use client";
import { useState } from "react";
import { productCopy } from "../lib/product-copy";
export function ShareLink({
  url,
  title,
  locale = "en",
}: {
  url: string;
  title: string;
  locale?: string;
}) {
  const [message, setMessage] = useState("");
  const copy = productCopy(locale);
  return (
    <div>
      <button
        type="button"
        className="rounded-lg border px-4 py-2 text-sm font-semibold"
        onClick={async () => {
          try {
            if (navigator.share) {
              await navigator.share({ url, title });
            } else {
              await navigator.clipboard.writeText(url);
              setMessage(copy.copied);
            }
          } catch {
            setMessage(copy.copy + ": " + url);
          }
        }}
      >
        {copy.share}
      </button>
      {message && (
        <p role="status" className="mt-2 break-all text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

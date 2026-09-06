"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type MediaAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  visibility: "PUBLIC" | "DEALER_ONLY" | "INTERNAL";
  created_at: string;
};

export function MediaWorkbench() {
  const router = useRouter();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await secureApiFetch<MediaAsset[]>("staff", "/media"));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("staff").catch(() => undefined);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load media.",
      );
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);

  function headers(): HeadersInit | null {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the current 6-digit MFA code first.");
      return null;
    }
    return { "x-mfa-code": mfaCode };
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mfaHeaders = headers();
    if (!mfaHeaders) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("upload");
    setError("");
    try {
      await secureApiFetch("staff", "/media/upload", {
        method: "POST",
        headers: mfaHeaders,
        body: form,
      });
      formElement.reset();
      setMfaCode("");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Upload failed.");
    } finally {
      setBusy("");
    }
  }

  async function remove(item: MediaAsset) {
    const mfaHeaders = headers();
    if (
      !mfaHeaders ||
      !window.confirm(`Permanently delete “${item.fileName}”?`)
    )
      return;
    setBusy(item.id);
    setError("");
    try {
      await secureApiFetch("staff", `/media/${item.id}`, {
        method: "DELETE",
        headers: mfaHeaders,
      });
      setMfaCode("");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Delete failed.");
    } finally {
      setBusy("");
    }
  }

  async function download(item: MediaAsset) {
    try {
      const signed = await secureApiFetch<{ url: string }>(
        "staff",
        `/media/${item.id}/sign?expire=60`,
      );
      window.open(`/api/v1${signed.url}`, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to create download link.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
          <h1 className="mt-1 text-3xl font-bold">Media library</h1>
          <p className="mt-2 text-sm text-neutral-500">
            JPG, PNG, WebP or PDF, up to 5 MB.
          </p>
        </div>
        <label className="text-sm">
          MFA code
          <input
            value={mfaCode}
            onChange={(event) =>
              setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="ml-2 w-28 rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <form
        onSubmit={upload}
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-end"
      >
        <label className="flex-1 text-sm">
          File
          <input
            required
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="mt-2 block w-full rounded-lg border border-neutral-300 p-2"
          />
        </label>
        <label className="text-sm">
          Visibility
          <select
            name="visibility"
            className="mt-2 block rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option>PUBLIC</option>
            <option>DEALER_ONLY</option>
            <option>INTERNAL</option>
          </select>
        </label>
        <button
          disabled={busy === "upload"}
          className="rounded-full bg-[var(--wm-dark)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Upload
        </button>
      </form>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center"
          >
            <div>
              <h2 className="font-semibold">{item.fileName}</h2>
              <p className="text-sm text-neutral-500">
                {item.mimeType} · {(item.size / 1024).toFixed(1)} KB ·{" "}
                {item.visibility}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void download(item)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Download
              </button>
              <button
                disabled={busy === item.id}
                onClick={() => void remove(item)}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

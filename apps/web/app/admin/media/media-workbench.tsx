"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type MediaAsset = {
  id: string;
  title: string;
  language: string;
  resourceType: string;
  tags: string[];
  decorative: boolean;
  publishedAt: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  size: number;
  visibility: "PUBLIC" | "REGISTERED" | "DEALER_ONLY" | "INTERNAL";
  created_at: string;
  alt: string;
  checksum: string;
  version: number;
  scanStatus: string;
  usageLocations: string[];
  companyIds: string[];
  productIds: string[];
  previousVersionId?: string;
};

export function MediaWorkbench() {
  const router = useRouter();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [cleanupJobs, setCleanupJobs] = useState<
    Array<{ key: string; status: string; attempts: number; lastError?: string }>
  >([]);
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await secureApiFetch<MediaAsset[]>("staff", "/media"));
      setCleanupJobs(await secureApiFetch("staff", "/media/cleanup-jobs"));
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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
          <h1 className="mt-1 text-3xl font-bold">Media library</h1>
          <p className="mt-2 text-sm text-neutral-500">
            JPG, PNG, WebP, PDF, MP4 or WebM, up to 50 MB.
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
            accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm"
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
            <option>REGISTERED</option>
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
      <label className="mt-5 block text-sm">
        Search title, filename, language or tags
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-3 rounded border p-2"
        />
      </label>
      <div className="mt-6 space-y-3">
        {cleanupJobs.length > 0 && (
          <section className="rounded border border-amber-200 bg-amber-50 p-4">
            <h2 className="font-semibold">Privacy attachment cleanup</h2>
            <p className="mt-1 text-sm">
              Pending files are unavailable for download. Cleanup retries
              automatically after temporary storage failures.
            </p>
            {cleanupJobs.map((job) => (
              <p key={job.key} className="mt-2 break-all text-xs">
                {job.key} · {job.status} · attempts {job.attempts} ·{" "}
                {job.lastError}
              </p>
            ))}
          </section>
        )}
        {items
          .filter((item) =>
            [
              item.title,
              item.fileName,
              item.language,
              item.resourceType,
              ...(item.tags ?? []),
            ]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <h2 className="font-semibold">{item.title || item.fileName}</h2>
                <p className="text-xs text-neutral-500">
                  {item.fileName} · {item.language} · {item.resourceType} ·{" "}
                  {item.tags?.join(", ")}
                </p>
                <p className="text-xs text-neutral-500">
                  Uploaded {new Date(item.created_at).toLocaleString()} by{" "}
                  {item.uploadedBy} · Published{" "}
                  {new Date(item.publishedAt).toLocaleDateString()}
                </p>
                {item.visibility === "PUBLIC" &&
                  item.mimeType.startsWith("image/") &&
                  !item.alt &&
                  !item.decorative && (
                    <p className="mt-2 text-sm text-amber-800">
                      Add meaningful alt text or mark this image as decorative.
                    </p>
                  )}
                <p className="text-sm text-neutral-500">
                  {item.mimeType} · {(item.size / 1024).toFixed(1)} KB ·{" "}
                  {item.visibility}
                </p>
                <p className="mt-1 break-all text-xs">
                  v{item.version} · {item.scanStatus} · SHA-256{" "}
                  {item.checksum ?? "legacy file"}
                </p>
              </div>
              <details>
                <summary className="cursor-pointer">
                  Metadata, access & version replacement
                </summary>
                <form
                  className="mt-3 grid gap-3 sm:grid-cols-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const h = headers();
                    if (!h) return;
                    const f = new FormData(e.currentTarget);
                    const array = (name: string) =>
                      String(f.get(name) ?? "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    setBusy(item.id);
                    try {
                      await secureApiFetch(
                        "staff",
                        `/media/${item.id}/metadata`,
                        {
                          method: "PATCH",
                          headers: h,
                          body: JSON.stringify({
                            alt: f.get("alt"),
                            title: f.get("title"),
                            language: f.get("language"),
                            resourceType: f.get("resourceType"),
                            tags: array("tags"),
                            decorative: f.get("decorative") === "on",
                            publishedAt: f.get("publishedAt")
                              ? new Date(
                                  String(f.get("publishedAt")) + "T00:00:00Z",
                                ).toISOString()
                              : undefined,
                            usageLocations: array("usageLocations"),
                            companyIds: array("companyIds"),
                            productIds: array("productIds"),
                            previousVersionId:
                              f.get("previousVersionId") || undefined,
                          }),
                        },
                      );
                      await load();
                      setMfaCode("");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  <label>
                    Resource title
                    <input
                      name="title"
                      maxLength={160}
                      defaultValue={item.title ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    Language
                    <input
                      name="language"
                      required
                      maxLength={30}
                      pattern="[a-z]{2,3}(-[A-Za-z0-9]{2,8})*"
                      defaultValue={item.language ?? "en"}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    Resource type
                    <select
                      name="resourceType"
                      defaultValue={item.resourceType ?? "OTHER"}
                      className="mt-1 w-full rounded border p-2"
                    >
                      {[
                        "CATALOG",
                        "MANUAL",
                        "IMAGE",
                        "VIDEO",
                        "CERTIFICATE",
                        "FORM",
                        "OTHER",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Publication date (UTC)
                    <input
                      type="date"
                      name="publishedAt"
                      defaultValue={item.publishedAt?.slice(0, 10)}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    Tags (comma separated)
                    <input
                      name="tags"
                      defaultValue={item.tags?.join(", ") ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="decorative"
                      defaultChecked={item.decorative}
                    />{" "}
                    Decorative image (empty alt is intentional)
                  </label>
                  <label>
                    Alt text
                    <input
                      name="alt"
                      defaultValue={item.alt}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  {["usageLocations", "companyIds", "productIds"].map((k) => (
                    <label key={k}>
                      {k} (comma separated)
                      <input
                        name={k}
                        defaultValue={(
                          item[
                            k as "usageLocations" | "companyIds" | "productIds"
                          ] ?? []
                        ).join(",")}
                        className="mt-1 w-full rounded border p-2"
                      />
                    </label>
                  ))}
                  <label>
                    Replaces media ID (upload new file first)
                    <input
                      name="previousVersionId"
                      defaultValue={item.previousVersionId ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <button
                    disabled={Boolean(busy)}
                    className="rounded bg-neutral-900 px-3 py-2 text-white"
                  >
                    Save metadata & grants
                  </button>
                </form>
              </details>
              <div className="flex gap-2">
                <button
                  onClick={() => void download(item)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Download
                </button>
                <button
                  disabled={busy === item.id}
                  onClick={async () => {
                    const h = headers();
                    if (!h) return;
                    setBusy(item.id);
                    setError("");
                    try {
                      await secureApiFetch(
                        "staff",
                        `/media/${item.id}/rescan`,
                        { method: "POST", headers: h },
                      );
                      setMfaCode("");
                    } catch (cause) {
                      setError((cause as Error).message);
                    } finally {
                      await load();
                      setBusy("");
                    }
                  }}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                >
                  Re-scan file
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

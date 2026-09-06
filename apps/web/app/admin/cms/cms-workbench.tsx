"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { secureApiFetch, sessionLogout } from "../../../lib/secure-api";

type CmsPageStatus = "DRAFT" | "PUBLISHED";
type CmsPage = {
  id: string;
  slug: string;
  title: string;
  status: CmsPageStatus;
  sections: unknown;
  updatedAt: string;
};

export function CmsWorkbench() {
  const router = useRouter();
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setPages(await secureApiFetch<CmsPage[]>("staff", "/admin/cms/pages"));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await sessionLogout("staff").catch(() => undefined);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof ApiError ? cause.message : "Unable to load CMS pages.",
      );
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function headers(): HeadersInit | null {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the current 6-digit MFA code before saving.");
      return null;
    }
    return { "x-mfa-code": mfaCode };
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mfaHeaders = headers();
    if (!mfaHeaders) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let sections: unknown;
    try {
      sections = JSON.parse(String(form.get("sections") ?? "[]"));
      if (!Array.isArray(sections)) throw new Error();
    } catch {
      setError("Sections must be a valid JSON array.");
      return;
    }
    setBusy("create");
    setError("");
    try {
      await secureApiFetch("staff", "/cms/pages", {
        method: "POST",
        headers: mfaHeaders,
        body: JSON.stringify({
          slug: String(form.get("slug") ?? "").trim(),
          title: String(form.get("title") ?? "").trim(),
          status: form.get("status"),
          sections,
        }),
      });
      formElement.reset();
      setMfaCode("");
      setNotice("CMS page created.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to create the CMS page.",
      );
    } finally {
      setBusy("");
    }
  }

  async function changeStatus(page: CmsPage, status: CmsPageStatus) {
    const mfaHeaders = headers();
    if (!mfaHeaders) return;
    if (
      !window.confirm(
        `Change “${page.title}” from ${page.status} to ${status}?`,
      )
    )
      return;
    setBusy(page.id);
    setError("");
    try {
      await secureApiFetch("staff", `/cms/pages/${page.id}`, {
        method: "PATCH",
        headers: mfaHeaders,
        body: JSON.stringify({ status }),
      });
      setMfaCode("");
      setNotice("Page status updated.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to update the page.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
          <h1 className="mt-1 text-3xl font-bold">CMS pages</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Draft content remains private until published.
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
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <form
        onSubmit={create}
        className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 md:grid-cols-2"
      >
        <h2 className="font-semibold md:col-span-2">Create page</h2>
        <input
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          maxLength={120}
          name="slug"
          placeholder="page-slug"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          required
          minLength={2}
          maxLength={160}
          name="title"
          placeholder="Page title"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          name="status"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option>DRAFT</option>
          <option>PUBLISHED</option>
        </select>
        <textarea
          required
          name="sections"
          defaultValue="[]"
          rows={4}
          aria-label="Sections JSON"
          className="rounded-lg border border-neutral-300 p-3 font-mono text-sm md:col-span-2"
        />
        <button
          disabled={busy === "create"}
          className="rounded-full bg-[var(--wm-dark)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 md:w-fit"
        >
          Create page
        </button>
      </form>
      <div className="mt-6 space-y-3">
        {pages.map((page) => (
          <article
            key={page.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center"
          >
            <div>
              <h2 className="font-semibold">{page.title}</h2>
              <p className="text-sm text-neutral-500">
                /{page.slug} · updated{" "}
                {new Date(page.updatedAt).toLocaleString()}
              </p>
            </div>
            <select
              disabled={busy === page.id}
              value={page.status}
              onChange={(event) =>
                void changeStatus(page, event.target.value as CmsPageStatus)
              }
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option>DRAFT</option>
              <option>PUBLISHED</option>
            </select>
          </article>
        ))}
      </div>
    </main>
  );
}

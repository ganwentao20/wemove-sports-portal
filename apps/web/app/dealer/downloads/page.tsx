"use client";
import { uiError } from "../../../lib/ui-i18n";

import { useUiText, useUiLocale } from "../../../components/ui-locale";

import { useEffect, useState } from "react";
import Link from "next/link";
import { secureApiFetch } from "../../../lib/secure-api";
type File = {
  id: string;
  title: string;
  language: string;
  resourceType: string;
  tags: string[];
  publishedAt: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: string;
  alt: string;
  version: number;
};
export default function Downloads() {
  const uiLocale = useUiLocale();

  const t = useUiText();

  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"dealer" | "customer">("dealer");
  useEffect(() => {
    const sessionKind =
      new URLSearchParams(location.search).get("registered") === "1"
        ? "customer"
        : "dealer";
    setKind(sessionKind);
    void secureApiFetch<File[]>(sessionKind, "/media/downloads")
      .then(setFiles)
      .catch((e) => setError(e.message));
  }, []);
  async function download(id: string) {
    try {
      const result = await secureApiFetch<{ url: string }>(
        kind,
        `/media/${id}/access`,
      );
      window.open(`/api/v1${result.url}`, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-10"
    >
      <Link
        className="underline"
        href={kind === "dealer" ? "/dealer/dashboard" : "/customer/account"}
      >
        {t("Dashboard")}
      </Link>
      <h1 className="my-5 text-3xl font-bold">
        {kind === "dealer"
          ? t("Company downloads")
          : t("Registered customer downloads")}
      </h1>
      <label>
        {t("Search files")}
        <input
          className="ml-3 rounded border p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p role="alert">{error ? uiError(uiLocale, error) : ""}</p>
      <ul className="mt-6 space-y-3">
        {files
          .filter((f) =>
            [f.title, f.fileName, f.language, f.resourceType, ...(f.tags ?? [])]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap justify-between gap-4 rounded border p-4"
            >
              <div>
                <strong>{f.title || f.fileName}</strong>
                <p>
                  {f.alt} · {f.language} · {t(f.resourceType)} ·{" "}
                  {new Date(f.publishedAt).toLocaleDateString(uiLocale)}{" "}
                  {t("· v")} {f.version} · {Math.ceil(f.sizeBytes / 1024)}{" "}
                  {t("KB ·")} {t(f.visibility)}
                </p>
              </div>
              <button onClick={() => void download(f.id)} className="underline">
                {t("Download")}
              </button>
            </li>
          ))}
      </ul>
      {!files.length && !error && (
        <p className="mt-4">
          {t("No authorized downloads are published yet.")}
        </p>
      )}
    </main>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { secureApiFetch } from "../lib/secure-api";
import { recordEvent } from "./consent-analytics";
import { translateUi, uiError } from "../lib/ui-i18n";
import { languageName } from "../lib/language-code";
import { publicUrl } from "../lib/public-url";
export type ProductFile = {
  id: string;
  title: string;
  fileName: string;
  language: string;
  resourceType: string;
  sizeBytes: number;
  version: number;
  visibility?: string;
  downloadUrl?: string;
};
export function ProductDownloads({
  productId,
  slug,
  locale,
  market,
  initial,
  kind,
}: {
  productId: string;
  slug: string;
  locale: string;
  market: string;
  initial: ProductFile[];
  kind: "dealer" | "customer" | null;
}) {
  const [files, setFiles] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  const text = (
    {
      zh: {
        title: "产品资料",
        download: "下载",
        signIn: "登录后查看您有权访问的更多资料",
        empty: "暂无已发布的产品资料。",
      },
      fr: {
        title: "Documents du produit",
        download: "Télécharger",
        signIn: "Connectez-vous pour accéder aux documents autorisés",
        empty: "Aucun document publié.",
      },
      de: {
        title: "Produktunterlagen",
        download: "Herunterladen",
        signIn: "Für zugängliche Unterlagen anmelden",
        empty: "Keine veröffentlichten Unterlagen.",
      },
    } as Record<string, Record<string, string>>
  )[locale.split("-")[0]] ?? {
    title: "Product resources",
    download: "Download",
    signIn: "Sign in for additional resources available to your account",
    empty: "No product resources are published yet.",
  };
  useEffect(() => {
    let active = true;
    if (kind)
      void secureApiFetch<ProductFile[]>(
        kind,
        "/media/downloads?productId=" + encodeURIComponent(productId),
      )
        .then((rows) => {
          if (active) setFiles(rows);
        })
        .catch(() => {
          if (active) setFiles(initial);
        });
    return () => {
      active = false;
    };
  }, [productId, kind, initial]);
  async function download(file: ProductFile) {
    setBusy(file.id);
    setError("");
    try {
      if (!kind) return;
      const link = await secureApiFetch<{ url: string }>(
        kind,
        `/media/${file.id}/access`,
      );
      const response = await fetch("/api/v1" + link.url);
      if (!response.ok)
        throw new Error("The resource is no longer available to this account.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      recordEvent("download_asset", {
        asset_id: file.id,
        product_id: productId,
        visibility: file.visibility,
      });
    } catch (error) {
      setError(uiError(locale, error));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="rounded-2xl border border-[var(--wm-border)] p-6">
      <h2 className="font-bold">{text.title}</h2>
      <p role="alert" className="mt-2 text-sm text-red-700">
        {error}
      </p>
      <ul className="mt-4 space-y-4">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <h3 className="font-semibold">{file.title || file.fileName}</h3>
              <p className="text-sm text-[var(--wm-muted)]">
                {languageName(file.language)} · {translateUi(locale, file.resourceType)} · v{file.version} ·{" "}
                {Math.ceil(file.sizeBytes / 1024)} KB
              </p>
            </div>
            {!kind && file.downloadUrl ? (
              <a
                className="underline"
                href={"/api/v1" + file.downloadUrl}
                data-asset-id={file.id}
              >
                {text.download}
              </a>
            ) : (
              <button
                disabled={busy !== null}
                className="underline"
                onClick={() => void download(file)}
              >
                {text.download}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!files.length && <p className="mt-4 text-sm">{text.empty}</p>}
      {!kind && (
        <Link
          className="mt-4 inline-block text-sm underline"
          href={
            publicUrl(
              "/login?next=" +
                encodeURIComponent("/" + locale + "/products/" + slug),
              locale,
              market,
            )
          }
        >
          {text.signIn}
        </Link>
      )}
    </section>
  );
}

import type { Metadata } from "next";
import { serverApiGet } from "../../../lib/server-api";

export const metadata: Metadata = { title: "Support & Downloads" };

type PublicMedia = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
};

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
};

function displayAnswer(answer: string) {
  try {
    const parsed = JSON.parse(answer) as unknown;
    if (!Array.isArray(parsed)) return answer;
    return parsed
      .map((section) => {
        if (typeof section === "string") return section;
        if (section && typeof section === "object") {
          const row = section as Record<string, unknown>;
          return String(row.body ?? row.content ?? row.text ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return answer;
  }
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 公开支持与下载中心：说明书/证书等 PUBLIC 媒体（media API，MD）；私有资料走 dealer 签名下载 */
export default async function SupportPage() {
  const [mediaResult, faqResult] = await Promise.all([
    serverApiGet<PublicMedia[]>("/media/public"),
    serverApiGet<Faq[]>("/faqs"),
  ]);
  const downloads = mediaResult.ok ? mediaResult.data : [];
  const faqs = faqResult.ok ? faqResult.data : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Support &amp; Downloads</h1>
      <p className="mt-2 max-w-2xl text-neutral-600">
        Manuals, certificates and FAQs. Dealers can access restricted documents
        after sign-in.
      </p>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Downloads</h2>
        {downloads.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {downloads.map((item) => (
              <a
                key={item.id}
                href={`/api/v1${item.downloadUrl}`}
                className="rounded-2xl border border-neutral-200 p-5 transition hover:border-[#2B5F8A] hover:shadow-sm"
              >
                <span className="font-medium text-neutral-900">
                  {item.fileName}
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  {item.mimeType} · {fileSize(item.sizeBytes)}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">
            No public downloads have been published yet.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        {faqs.length ? (
          <div className="mt-4 divide-y rounded-2xl border border-neutral-200 px-5">
            {faqs.map((item) => (
              <details key={item.id} className="group py-4">
                <summary className="cursor-pointer list-none font-medium">
                  {item.question}
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-600">
                  {displayAnswer(item.answer)}
                </p>
              </details>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">
            No FAQs have been published yet. Use the contact form if you need
            help.
          </p>
        )}
      </section>
    </div>
  );
}

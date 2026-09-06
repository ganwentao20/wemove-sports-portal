import type { Metadata } from "next";
import { serverApiGet } from "../../../lib/server-api";

export const metadata: Metadata = { title: "Play & Learn" };

type Article = {
  id: string;
  title: string;
  slug: string;
  content: unknown;
  updated_at: string;
};

function articleText(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((section) => {
      if (typeof section === "string") return [section];
      if (!section || typeof section !== "object") return [];
      const row = section as Record<string, unknown>;
      const value = row.body ?? row.content ?? row.text;
      return typeof value === "string" ? [value] : [];
    })
    .join("\n");
}

export default async function PlayLearnPage() {
  const result = await serverApiGet<Article[]>("/articles");
  const articles = result.ok ? result.data : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Play &amp; Learn</h1>
      <p className="mt-2 max-w-2xl text-neutral-600">
        Activity guides, skill-building tips and ideas for active family play.
      </p>
      {articles.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <article
              key={article.id}
              className="rounded-2xl border border-neutral-200 p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2B5F8A]">
                Play guide
              </p>
              <h2 className="mt-2 text-xl font-semibold">{article.title}</h2>
              <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm leading-6 text-neutral-600">
                {articleText(article.content) ||
                  "This guide is ready for its published content."}
              </p>
              <time
                className="mt-5 block text-xs text-neutral-400"
                dateTime={article.updated_at}
              >
                Updated{" "}
                {new Date(article.updated_at).toLocaleDateString("en-US")}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No play guides have been published yet.
        </p>
      )}
    </div>
  );
}

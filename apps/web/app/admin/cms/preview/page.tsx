import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_ORIGIN, SESSION_COOKIE } from "../../../../lib/session-server";
import { ContentBlocks } from "../../../../components/content-blocks";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Content preview",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams,
    token = (await cookies()).get(SESSION_COOKIE.staff)?.value;
  if (!token) redirect("/admin/login");
  const response = await fetch(
    `${API_ORIGIN}/api/v1/admin/cms/pages/${encodeURIComponent(id ?? "")}/preview`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok)
    return (
      <main id="main-content" tabIndex={-1} className="p-10">
        <h1>Preview unavailable</h1>
        <p>{result.message}</p>
      </main>
    );
  const page = result.data;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-12"
    >
      <p className="mb-6 rounded border bg-amber-50 p-3">
        Authorized preview · {page.status} · Version {page.revision}
      </p>
      <h1 className="mb-8 text-4xl font-bold">{page.title}</h1>
      <ContentBlocks sections={page.sections} locale={page.locale} />
    </main>
  );
}

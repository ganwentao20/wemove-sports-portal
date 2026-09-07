import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApiGet } from "../../../../lib/server-api";
import { SITE_URL } from "../../../../lib/locale";
import {
  DealerFinder,
  type Dealer,
} from "../../../../components/dealer-finder";
async function dealer(id: string) {
  return serverApiGet<Dealer>(`/dealer/directory/${encodeURIComponent(id)}`);
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params,
    result = await dealer(id);
  if (!result.ok)
    return { title: "Dealer not found", robots: { index: false } };
  const store = result.data;
  return {
    title: `${store.companyName} | Authorized WEMOVE dealer`,
    description:
      store.description ||
      `${store.companyName}, ${store.city}, ${store.country}`,
    robots: { index: store.description.length >= 100, follow: true },
    alternates: { canonical: `${SITE_URL}/en/dealers/${id}` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    result = await dealer(id);
  if (!result.ok) notFound();
  const store = result.data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/dealers" className="underline">
        All dealers
      </Link>
      <h1 className="my-6 text-4xl font-bold">{store.companyName}</h1>
      {store.description && (
        <p className="mb-8 max-w-3xl whitespace-pre-wrap leading-7">
          {store.description}
        </p>
      )}
      <DealerFinder dealers={[store]} />
    </div>
  );
}

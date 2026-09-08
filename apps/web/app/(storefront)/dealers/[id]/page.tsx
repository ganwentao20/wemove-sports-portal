import { getUiText } from "../../../../lib/ui-i18n-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApiGet } from "../../../../lib/server-api";
import { SITE_URL, getLocale } from "../../../../lib/locale";
import {
  DealerFinder,
  type Dealer,
} from "../../../../components/dealer-finder";
async function dealer(id: string) {
  return serverApiGet<Dealer>(
    `/dealer/directory/${encodeURIComponent(id)}?locale=${await getLocale()}`,
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const t = await getUiText();
  const locale = await getLocale();
  const { id } = await params,
    result = await dealer(id);
  if (!result.ok)
    return { title: t("Dealer not found"), robots: { index: false } };
  const store = result.data;
  return {
    title: `${store.companyName} | ${t("Authorized WEMOVE dealer")}`,
    description:
      store.description ||
      `${store.companyName}, ${store.city}, ${store.country}`,
    robots: { index: store.description.length >= 100, follow: true },
    alternates: { canonical: `${SITE_URL}/${locale}/dealers/${id}` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getUiText();
  const { id } = await params,
    result = await dealer(id);
  if (!result.ok) notFound();
  const store = result.data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/dealers" className="underline">
        {t("All dealers")}
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

import { getUiText } from "../../../lib/ui-i18n-server";
import { DealerFinder } from "../../../components/dealer-finder";
import { getLocale } from "../../../lib/locale";
import { serverApiGet } from "../../../lib/server-api";
export async function generateMetadata() {
  const t = await getUiText();
  return { title: t("Find a dealer") };
}
export const dynamic = "force-dynamic";
export default async function Page() {
  const t = await getUiText();
  const result = await serverApiGet<
    Parameters<typeof DealerFinder>[0]["dealers"]
  >(`/dealer/directory?locale=${await getLocale()}`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="mb-8 text-4xl font-bold">{t("Find a dealer")}</h1>
      {result.ok ? (
        <DealerFinder dealers={result.data} />
      ) : (
        <p role="status">
          {t("Dealer directory temporarily unavailable. Please try again.")}
        </p>
      )}
    </div>
  );
}

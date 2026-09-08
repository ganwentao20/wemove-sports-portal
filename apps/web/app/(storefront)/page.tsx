import type { Metadata } from "next";
import { OriginalHome } from "../../components/original-home";
import { serverApiGet } from "../../lib/server-api";
import { getLocale, getMarket } from "../../lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale.startsWith("zh")
    ? {
        title: "WEMOVE｜原木滚珠轨道积木、STEM教育与木作创新",
        description:
          "探索 WEMOVE 原木滚珠轨道积木、STEM 教育、原木家具、中试打样与科研内容。",
      }
    : {
        title: "WEMOVE | Wooden marble runs, STEM learning and craft",
        description:
          "Explore WEMOVE wooden marble runs, STEM learning, furniture, prototyping and research.",
      };
}

export default async function HomePage() {
  const locale = await getLocale();
  const market = await getMarket();
  const home = await serverApiGet<Array<{ sections: unknown }>>(
    `/cms/pages?slug=home&locale=${locale}&market=${market}`,
  );
  return (
    <OriginalHome
      sections={home.ok && home.data.length ? home.data[0].sections : null}
      locale={locale}
      market={market}
    />
  );
}

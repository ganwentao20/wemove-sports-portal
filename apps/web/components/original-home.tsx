import Image from "next/image";
import Link from "next/link";
import {
  homeFeaturesFromCms,
  type OriginalHomeFeature,
} from "../lib/original-home";
import { publicUrl } from "../lib/public-url";
import { ContentBlocks } from "./content-blocks";

function Feature({
  feature,
  priority,
  locale,
  market,
}: {
  feature: OriginalHomeFeature;
  priority: boolean;
  locale: string;
  market: string;
}) {
  const mobileImageSpacing =
    feature.imageSide === "left" ? "mx-6 mb-0 mt-10" : "mx-6 mb-10 mt-0";
  const image = (
    <div
      className={`relative aspect-[3/2] overflow-hidden ${mobileImageSpacing} md:m-3 md:min-h-[496px] md:aspect-auto`}
    >
      <Image
        src={feature.image}
        alt={feature.alt}
        fill
        priority={priority}
        sizes="(max-width: 767px) 100vw, 50vw"
        className="object-cover"
      />
    </div>
  );
  const copy = (
    <div className="flex min-h-[280px] items-center justify-center px-6 py-8 text-center sm:px-12 md:min-h-[520px] md:py-14 lg:px-20">
      <div className="max-w-xl">
        <h2 className="text-3xl font-normal tracking-[-0.03em] text-[#333] sm:text-4xl">
          {feature.title}
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-base leading-8 text-[#6c706c] sm:text-lg">
          {feature.text}
        </p>
        {feature.href && feature.label ? (
          <Link
            href={
              feature.href.startsWith("/")
                ? publicUrl(feature.href, locale, market)
                : feature.href
            }
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-[4px] bg-[#333] px-8 py-3 text-base font-medium text-white transition-colors hover:bg-[#171717]"
          >
            {feature.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
  return (
    <section
      data-module-id={feature.id}
      className={feature.tone === "green" ? "bg-[#eef4e3]" : "bg-white"}
    >
      <div className="grid md:grid-cols-2">
        {feature.imageSide === "left" ? image : copy}
        {feature.imageSide === "left" ? copy : image}
      </div>
    </section>
  );
}

export function OriginalHome({
  sections,
  locale,
  market,
}: {
  sections: unknown;
  locale: string;
  market: string;
}) {
  const features = homeFeaturesFromCms(sections, locale);
  const additionalSections = Array.isArray(sections)
    ? sections.filter(
        (section) =>
          !section ||
          typeof section !== "object" ||
          (section as { type?: string }).type !== "original-feature",
      )
    : [];
  const isZh = locale.startsWith("zh");
  const local = (path: string) => publicUrl(path, locale, market);
  return (
    <div className="wm-original-home">
      {features.length ? <div className="relative aspect-[3/2] overflow-hidden md:hidden">
        <Image
          src="/original-site/home-wemove-set.png"
          alt={isZh ? "WEMOVE 原木积木搭建场景" : "Building with WEMOVE wooden blocks"}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div> : null}
      {features.map((feature, index) => (
        <Feature
          key={feature.id}
          feature={feature}
          priority={index === 0}
          locale={locale}
          market={market}
        />
      ))}
      {additionalSections.length ? (
        <section className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
          <ContentBlocks sections={additionalSections} locale={locale} />
        </section>
      ) : null}
      <section className="border-t border-[#e8e8e8] bg-white px-6 py-16 sm:px-10 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.7fr] lg:items-end">
            <div>
              <p className="text-sm tracking-[0.18em] text-[#7a7a73]">{isZh ? "选购与服务" : "SHOP AND SERVICE"}</p>
              <h2 className="mt-3 text-3xl font-normal tracking-[-0.03em] text-[#333] sm:text-4xl">
                {isZh ? "原站体验，连接完整业务能力" : "The original experience, connected to complete services"}
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-[#6c706c]">
              {isZh
                ? "浏览产品参数与适龄建议，使用搜索和产品对比辅助选择；学校、零售商与合作伙伴可继续进入经销商申请、资料下载和采购门户。"
                : "Review specifications and age guidance, compare products, or continue to dealer applications, downloads and the purchasing portal."}
            </p>
          </div>
          <nav
            className="mt-9 grid border-y border-[#deded8] sm:grid-cols-2 lg:grid-cols-4"
            aria-label={isZh ? "选购与服务" : "Shop and service"}
          >
            {[
              [isZh ? "完整产品中心" : "Product centre", local("/products")],
              [isZh ? "产品搜索与对比" : "Search and compare", local("/search")],
              [isZh ? "说明书与支持" : "Manuals and support", local("/support")],
              [isZh ? "经销商合作" : "Dealer programme", "/dealer/apply"],
            ].map(([label, href], index) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between px-5 py-5 text-sm font-medium text-[#333] transition-colors hover:bg-[#eef4e3] ${index > 0 ? "sm:border-l sm:border-[#deded8]" : ""}`}
              >
                {label}<span aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </div>
  );
}

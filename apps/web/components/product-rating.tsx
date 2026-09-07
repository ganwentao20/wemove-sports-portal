export type RatingSummary = { average: number; count: number; source: string };
export function ProductRating({
  rating,
  locale = "en",
}: {
  rating: RatingSummary | null | undefined;
  locale?: string;
}) {
  if (!rating) return null;
  const language = locale.split("-")[0];
  const copy = (
    {
      en: ["reviews", "Source"],
      zh: ["条评价", "来源"],
      fr: ["avis", "Source"],
      de: ["Bewertungen", "Quelle"],
    } as Record<string, string[]>
  )[language] ?? ["reviews", "Source"];
  return (
    <div className="mt-3 text-sm" data-product-rating>
      <p>
        <span aria-hidden="true" className="text-amber-600">
          ★{" "}
        </span>
        <strong>
          {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
            rating.average,
          )}{" "}
          / 5
        </strong>
        <span>
          {" "}
          · {new Intl.NumberFormat(locale).format(rating.count)} {copy[0]}
        </span>
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {copy[1]}: {rating.source}
      </p>
    </div>
  );
}
export function ratingStructuredData(rating: RatingSummary | null | undefined) {
  return rating
    ? {
        "@type": "AggregateRating",
        ratingValue: rating.average,
        reviewCount: rating.count,
        bestRating: 5,
        worstRating: 1,
      }
    : undefined;
}

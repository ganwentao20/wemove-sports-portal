"use client";
import { useState } from "react";
import { CatalogVisual } from "./catalog-visual";
import { useProductSelection } from "./product-selection";
import { productCopy } from "../lib/product-copy";
function safe(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.startsWith("/media/")) return `/api/v1${value}`;
  return /^https?:\/\//.test(value) ||
    (value.startsWith("/") && !value.startsWith("//"))
    ? value
    : null;
}
export function ProductGallery({
  name,
  gallery,
  locale = "en",
}: {
  name: string;
  gallery: unknown;
  locale?: string;
}) {
  const copy = productCopy(locale);
  const selection = useProductSelection();
  const attrs = selection?.variants.find((v) => v.id === selection.selected)
    ?.attrs as Record<string, unknown> | undefined;
  const effectiveGallery =
    Array.isArray(attrs?.gallery) && attrs.gallery.length
      ? attrs.gallery
      : gallery;
  const media = Array.isArray(effectiveGallery)
    ? effectiveGallery.flatMap((item, index) => {
        const row =
          typeof item === "string"
            ? { url: item }
            : (item as Record<string, unknown>);
        const url = safe(row?.url);
        return url
          ? [
              {
                url,
                alt:
                  typeof row.alt === "string"
                    ? row.alt
                    : `${name} — ${copy.image} ${index + 1}`,
                type: typeof row.type === "string" ? row.type : "image",
              },
            ]
          : [];
      })
    : [];
  const [selected, setSelected] = useState(0);
  const current = media[selected] ?? media[0];
  return (
    <div>
      <div
        className="overflow-hidden rounded-[6px]"
        onTouchStart={(e) => {
          e.currentTarget.dataset.start = String(e.touches[0].clientX);
        }}
        onTouchEnd={(e) => {
          const delta =
            e.changedTouches[0].clientX - Number(e.currentTarget.dataset.start);
          if (Math.abs(delta) > 40 && media.length)
            setSelected(
              (selected + (delta < 0 ? 1 : -1) + media.length) % media.length,
            );
        }}
      >
        {current?.type === "video" ? (
          <video
            controls
            playsInline
            className="aspect-square w-full bg-neutral-100"
            src={current.url}
            aria-label={current.alt}
          />
        ) : (
          <CatalogVisual
            name={current?.alt ?? name}
            imageUrl={current?.url}
            priority
            className="aspect-square"
          />
        )}
      </div>
      {media.length > 1 && (
        <div
          className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2"
          role="group"
          aria-label={copy.gallery}
        >
          {media.map((item, index) => (
            <button
              key={`${item.url}-${index}`}
              className={`w-20 shrink-0 snap-start overflow-hidden rounded-lg border-2 ${selected === index ? "border-[var(--wm-primary)]" : "border-transparent"}`}
              onClick={() => setSelected(index)}
              aria-label={item.alt}
              aria-pressed={selected === index}
            >
              {item.type === "video" ? (
                <span className="flex aspect-square items-center justify-center text-sm">
                  {copy.video}
                </span>
              ) : (
                <CatalogVisual
                  name={item.alt}
                  imageUrl={item.url}
                  className="aspect-square"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

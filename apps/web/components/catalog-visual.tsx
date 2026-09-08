import Image from "next/image";

const FALLBACK_IMAGE = "/original-site/product-standard-50.jpg";

export function CatalogVisual({
  name,
  imageUrl,
  priority = false,
  className = "",
}: {
  name: string;
  imageUrl?: string | null;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#f4f1ea] ${className}`}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          quality={60}
          alt={name}
          fill
          unoptimized={
            !(
              imageUrl.startsWith("/images/") ||
              /^\/api\/v1\/media\/[\w-]+\/download$/.test(imageUrl)
            )
          }
          preload={priority}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? undefined : "lazy"}
          sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      ) : (
        <Image
          src={FALLBACK_IMAGE}
          quality={60}
          alt={name}
          fill
          preload={priority}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? undefined : "lazy"}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      )}
    </div>
  );
}

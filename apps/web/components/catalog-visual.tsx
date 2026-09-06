import Image from "next/image";

const FALLBACK_IMAGE = "/images/wemove-active-play-hero.png";
const POSITIONS = ["72% 50%", "88% 32%", "58% 70%", "42% 62%"];

function positionFor(name: string) {
  const value = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return POSITIONS[value % POSITIONS.length];
}

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
    <div className={`relative overflow-hidden bg-[#cfe2eb] ${className}`}>
      {imageUrl ? (
        // Catalog media can be API-relative and is already validated by the page.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <Image
          src={FALLBACK_IMAGE}
          alt={`${name} active play collection`}
          fill
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          style={{ objectPosition: positionFor(name) }}
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-[#102332]/20 via-transparent to-white/5" aria-hidden="true" />
    </div>
  );
}

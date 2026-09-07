"use client";
import { useState } from "react";
import Link from "next/link";
export function AnnouncementBanner({
  id,
  title,
  href,
  dismissible = true,
  locale = "en",
}: {
  id: string;
  title: string;
  href?: string;
  dismissible?: boolean;
  locale?: string;
}) {
  const [closed, setClosed] = useState(false);
  if (closed && dismissible) return null;
  const copy = (
    {
      zh: ["站点公告", "关闭公告"],
      fr: ["Annonce", "Fermer l’annonce"],
      de: ["Mitteilung", "Mitteilung schließen"],
    } as Record<string, string[]>
  )[locale.split("-")[0]] ?? ["Site announcement", "Dismiss announcement"];
  return (
    <aside
      data-module-id={"announcement-" + id}
      className="flex justify-center gap-5 bg-[var(--wm-dark)] px-4 py-2 text-center text-sm text-white"
      aria-label={copy[0]}
    >
      {href ? <Link href={href}>{title}</Link> : title}
      {dismissible && (
        <button onClick={() => setClosed(true)} aria-label={copy[1]}>
          ×
        </button>
      )}
    </aside>
  );
}

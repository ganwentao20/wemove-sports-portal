"use client";
import { useUiText } from "./ui-locale";

import { useState } from "react";
import Link from "next/link";
export type Dealer = {
  logo: string | null;
  phone: string;
  dealerType: string;
  openingHours: string;
  description: string;
  region: string;
  postalCode: string;
  online: boolean;
  physical: boolean;
  categories: Array<{ id: string; name: string }>;
  detailPath: string | null;
  id: string;
  companyName: string;
  country: string;
  city: string | null;
  address: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
};
export function DealerFinder({ dealers }: { dealers: Dealer[] }) {
  const t = useUiText();
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const rows = dealers.filter((d) =>
    `${d.companyName} ${d.country} ${d.city ?? ""} ${d.region ?? ""} ${d.postalCode ?? ""} ${d.address ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const active = rows.find((d) => d.id === selected);
  const map =
    active && active.latitude !== null && active.longitude !== null
      ? new URLSearchParams({
          bbox: [
            active.longitude - 0.06,
            active.latitude - 0.04,
            active.longitude + 0.06,
            active.latitude + 0.04,
          ].join(","),
          layer: "mapnik",
          marker: active.latitude + "," + active.longitude,
        })
      : null;
  return (
    <div>
      <label className="block">
        {t("Search by country, state, city, postal code or name")}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          className="my-4 w-full rounded-xl border p-3"
        />
      </label>
      <div className="grid gap-8 lg:grid-cols-2">
        <div
          aria-label={t("Dealer map")}
          className="relative aspect-[2/1] overflow-hidden rounded-xl border bg-[#e4edf1]"
        >
          <>
            {map ? (
              <iframe
                title={t("Street map for {name}", {
                  name: active!.companyName,
                })}
                src={"https://www.openstreetmap.org/export/embed.html?" + map}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <svg
                viewBox="0 0 720 360"
                className="h-full w-full"
                role="img"
                aria-label={t("World coordinate map with dealer locations")}
              >
                <path
                  d="M0 180H720M360 0V360M0 90H720M0 270H720M180 0V360M540 0V360"
                  stroke="#a7bfca"
                  fill="none"
                />
                {rows
                  .filter((d) => d.latitude !== null && d.longitude !== null)
                  .map((d) => (
                    <g
                      key={d.id}
                      tabIndex={0}
                      role="button"
                      aria-label={d.companyName}
                      onClick={() => setSelected(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setSelected(d.id);
                      }}
                    >
                      <circle
                        cx={(d.longitude! + 180) * 2}
                        cy={(90 - d.latitude!) * 2}
                        r={d.id === selected ? 9 : 6}
                        fill={d.id === selected ? "#b5482e" : "#245f7e"}
                      />
                      <title>{d.companyName}</title>
                    </g>
                  ))}
              </svg>
            )}
          </>
          <span className="absolute bottom-2 left-3 text-xs">
            {map
              ? t("Map data © OpenStreetMap contributors")
              : t("Select a dealer to open its street map")}
          </span>
        </div>
        <ul className="space-y-4">
          {rows.map((d) => (
            <li
              key={d.id}
              className={`rounded-xl border p-5 ${d.id === selected ? "border-[#245f7e] bg-sky-50" : ""}`}
            >
              {d.logo && (
                <img
                  src={d.logo}
                  alt={t("{name} logo", { name: d.companyName })}
                  className="mb-3 h-16 max-w-40 object-contain"
                  loading="lazy"
                />
              )}
              <button
                className="text-left text-lg font-bold underline"
                onClick={() => setSelected(d.id)}
              >
                {d.companyName}
              </button>
              <p className="my-2">
                {d.address} {d.city} {d.region} {d.postalCode}, {d.country}
              </p>
              <p className="mb-2 text-sm">
                {[
                  t(d.dealerType),
                  d.online ? t("Online store") : "",
                  d.physical ? t("Physical store") : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {d.phone && (
                <a
                  className="mb-2 block underline"
                  href={`tel:${d.phone.replace(/[^+0-9]/g, "")}`}
                >
                  {d.phone}
                </a>
              )}
              {d.openingHours && (
                <p className="mb-2 whitespace-pre-wrap text-sm">
                  {t("Opening information:")}
                  {d.openingHours}
                </p>
              )}
              {d.categories.length > 0 && (
                <p className="mb-3 text-sm">
                  {t("Authorized categories:")}{" "}
                  {d.categories.map((c) => c.name).join(", ")}
                </p>
              )}
              {d.detailPath && (
                <Link className="mr-4 underline" href={d.detailPath}>
                  {t("Store details")}
                </Link>
              )}
              {d.website && (
                <a
                  href={d.website}
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {t("Visit website")}
                </a>
              )}
              {d.latitude !== null && d.longitude !== null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=14/${d.latitude}/${d.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 underline"
                >
                  {t("Street map")}
                </a>
              )}
            </li>
          ))}
          {!rows.length && (
            <li className="rounded-xl border p-6">
              {t("No published dealers match this location.")}{" "}
              <Link className="underline" href="/contact">
                {t("Contact our team")}
              </Link>{" "}
              {t("for buying options.")}
            </li>
          )}
        </ul>
      </div>
      {active && (
        <p role="status" className="mt-4">
          {t("Selected:")}
          {active.companyName}, {active.city}, {active.country}
        </p>
      )}
    </div>
  );
}

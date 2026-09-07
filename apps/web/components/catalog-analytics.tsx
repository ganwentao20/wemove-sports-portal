"use client";
import { useEffect } from "react";
import { recordEvent } from "./consent-analytics";
export function CatalogAnalytics({ filters }: { filters: string[] }) {
  const key = filters.join(",");
  useEffect(() => {
    if (key)
      recordEvent("select_filter", { filter_name: "catalog", value: key });
  }, [key]);
  return null;
}

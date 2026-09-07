"use client";
import { useEffect } from "react";
import { recordEvent } from "./consent-analytics";
export function SearchAnalytics({
  query,
  total,
}: {
  query: string;
  total: number;
}) {
  useEffect(() => {
    if (query) recordEvent("search", { query, results_count: total });
  }, [query, total]);
  return null;
}

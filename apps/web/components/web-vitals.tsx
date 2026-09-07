"use client";
import { useReportWebVitals } from "next/web-vitals";
import { recordEvent } from "./consent-analytics";
const report: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  recordEvent("web_vital", {
    metric_name: metric.name,
    metric_value: metric.value,
    metric_id: metric.id,
    rating: metric.rating,
  });
};
export function WebVitals() {
  useReportWebVitals(report);
  return null;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "../../../lib/api";
import { bearer, STAFF_TOKEN_KEY } from "../../../lib/auth";

type ApplicationStatus =
  "SUBMITTED" | "UNDER_REVIEW" | "MORE_INFO_REQUIRED" | "APPROVED" | "REJECTED";
type Application = {
  id: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  country: string;
  businessType: string;
  status: ApplicationStatus;
  remark: string | null;
  createdAt: string;
};

const statusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFO_REQUIRED: "More info required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function DealerReviewWorkbench() {
  const router = useRouter();
  const [items, setItems] = useState<Application[]>([]);
  const [filter, setFilter] = useState("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = localStorage.getItem(STAFF_TOKEN_KEY);
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = filter ? `?status=${filter}` : "";
      setItems(
        await apiFetch<Application[]>(`/admin/dealer/applications${query}`, {
          headers: bearer(token),
        }),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        localStorage.removeItem(STAFF_TOKEN_KEY);
        router.replace("/admin/login");
        return;
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to load applications.",
      );
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(
    id: string,
    status: Exclude<ApplicationStatus, "SUBMITTED">,
  ) {
    const token = localStorage.getItem(STAFF_TOKEN_KEY);
    if (!token) return router.replace("/admin/login");
    setError("");
    try {
      await apiFetch(`/admin/dealer/applications/${id}/review`, {
        method: "PATCH",
        headers: bearer(token),
        body: JSON.stringify({
          status,
          remark: remarks[id]?.trim() || undefined,
        }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Review failed.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#2B5F8A]">WEMOVE ADMIN</p>
          <h1 className="mt-1 text-3xl font-bold">Dealer applications</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Review qualifications with auditable state transitions.
          </p>
        </div>
        <label className="text-sm">
          Status{" "}
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="ml-2 rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="">All</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-8 text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-neutral-500">
          No applications found.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((item) => {
            const terminal =
              item.status === "APPROVED" || item.status === "REJECTED";
            return (
              <article
                key={item.id}
                className="rounded-xl border border-neutral-200 bg-white p-5"
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <h2 className="font-semibold">
                      {item.contactName} · {item.businessType}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      {item.contactEmail} · {item.phone} · {item.country}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Submitted {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="h-fit rounded bg-[#F0F5FA] px-3 py-1 text-xs font-semibold text-[#2B5F8A]">
                    {statusLabels[item.status]}
                  </span>
                </div>
                {!terminal && (
                  <div className="mt-4 border-t pt-4">
                    <textarea
                      value={remarks[item.id] ?? ""}
                      onChange={(event) =>
                        setRemarks((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      maxLength={500}
                      placeholder="Review note (required for more info or rejection)"
                      className="w-full rounded-lg border border-neutral-300 p-3 text-sm"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void review(item.id, "UNDER_REVIEW")}
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Start review
                      </button>
                      <button
                        onClick={() =>
                          void review(item.id, "MORE_INFO_REQUIRED")
                        }
                        className="rounded-lg border border-amber-500 px-3 py-2 text-sm text-amber-700"
                      >
                        Request more info
                      </button>
                      <button
                        onClick={() => void review(item.id, "APPROVED")}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void review(item.id, "REJECTED")}
                        className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                {item.remark && (
                  <p className="mt-3 text-sm text-neutral-600">
                    Note: {item.remark}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

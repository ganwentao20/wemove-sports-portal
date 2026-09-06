"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "../../../lib/api";

type ApplicationResponse = {
  id: string;
  status: string;
};

type FormData = {
  companyName: string;
  legalRegNo: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  country: string;
  businessType: string;
  documentName: string;
  documentUrl: string;
};

const initialForm: FormData = {
  companyName: "",
  legalRegNo: "",
  contactName: "",
  contactEmail: "",
  phone: "",
  country: "",
  businessType: "",
  documentName: "",
  documentUrl: "",
};

const inputClass =
  "mt-2 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-950 outline-none transition focus:border-[#2B5F8A] focus:ring-2 focus:ring-[#2B5F8A]/20";

const steps = ["Contact", "Business", "Review"];

export function DealerApplicationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const progress = useMemo(
    () => `${((step + 1) / steps.length) * 100}%`,
    [step],
  );

  function update(field: keyof FormData, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function validateCurrentStep() {
    if (
      step === 0 &&
      (!form.contactName.trim() ||
        !form.contactEmail.trim() ||
        !form.phone.trim())
    ) {
      return "Please complete all contact fields.";
    }
    if (
      step === 1 &&
      (!form.companyName.trim() ||
        !form.legalRegNo.trim() ||
        !form.country.trim() ||
        !form.businessType)
    ) {
      return "Please provide the company name, registration number, country and business type.";
    }
    if (form.documentUrl && !/^https?:\/\//i.test(form.documentUrl)) {
      return "The qualification document link must start with http:// or https://.";
    }
    return "";
  }

  function nextStep() {
    const message = validateCurrentStep();
    if (message) {
      setError(message);
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) {
      setError(
        "Please confirm that the information is accurate and authorized.",
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const attachments = form.documentUrl.trim()
        ? [
            {
              fileName:
                form.documentName.trim() || "Business qualification document",
              key: `external/${encodeURIComponent(form.documentName.trim() || "qualification-document")}`,
              url: form.documentUrl.trim(),
              visibility: "PRIVATE" as const,
            },
          ]
        : [];

      const application = await apiFetch<ApplicationResponse>(
        "/dealer/applications",
        {
          method: "POST",
          body: JSON.stringify({
            companyName: form.companyName.trim(),
            legalRegNo: form.legalRegNo.trim(),
            contactName: form.contactName.trim(),
            contactEmail: form.contactEmail.trim(),
            phone: form.phone.trim(),
            country: form.country.trim(),
            businessType: form.businessType,
            attachments,
          }),
        },
      );

      const query = new URLSearchParams({
        id: application.id,
        status: application.status,
      });
      router.push(`/dealer/apply/success?${query.toString()}`);
    } catch (cause) {
      setError(applicationErrorMessage(cause));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2B5F8A]">
        WEMOVE Sports B2B
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Become a WEMOVE Dealer
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Apply for verified dealer access. Our team will review the submitted
        business details before approval.
      </p>

      <ol
        className="mt-8 grid grid-cols-3 gap-2"
        aria-label="Application progress"
      >
        {steps.map((label, index) => (
          <li
            key={label}
            className={index <= step ? "text-[#2B5F8A]" : "text-neutral-400"}
          >
            <span className="block text-xs font-semibold sm:text-sm">
              {index + 1}. {label}
            </span>
          </li>
        ))}
      </ol>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200"
        aria-hidden="true"
      >
        <div
          className="h-full bg-[#2B5F8A] transition-all"
          style={{ width: progress }}
        />
      </div>

      <form
        onSubmit={submit}
        className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-8"
      >
        {step === 0 && (
          <section aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="text-xl font-semibold">
              Contact details
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Tell us who should receive application updates.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Contact name" required>
                <input
                  className={inputClass}
                  value={form.contactName}
                  onChange={(event) =>
                    update("contactName", event.target.value)
                  }
                  autoComplete="name"
                  required
                />
              </Field>
              <Field label="Business email" required>
                <input
                  className={inputClass}
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    update("contactEmail", event.target.value)
                  }
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Phone" required>
                <input
                  className={inputClass}
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  autoComplete="tel"
                  required
                />
              </Field>
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="business-heading">
            <h2 id="business-heading" className="text-xl font-semibold">
              Business details
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Qualification proof is optional for initial submission and can be
              provided as a secure link.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Company name" required>
                <input
                  className={inputClass}
                  value={form.companyName}
                  onChange={(event) => update("companyName", event.target.value)}
                  autoComplete="organization"
                  required
                />
              </Field>
              <Field label="Registration number" required>
                <input
                  className={inputClass}
                  value={form.legalRegNo}
                  onChange={(event) => update("legalRegNo", event.target.value)}
                  required
                />
              </Field>
              <Field label="Country or region" required>
                <input
                  className={inputClass}
                  value={form.country}
                  onChange={(event) => update("country", event.target.value)}
                  autoComplete="country-name"
                  required
                />
              </Field>
              <Field label="Business type" required>
                <select
                  className={inputClass}
                  value={form.businessType}
                  onChange={(event) =>
                    update("businessType", event.target.value)
                  }
                  required
                >
                  <option value="">Select a type</option>
                  <option value="RETAILER">Retailer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="WHOLESALER">Wholesaler</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Document name">
                <input
                  className={inputClass}
                  value={form.documentName}
                  onChange={(event) =>
                    update("documentName", event.target.value)
                  }
                  placeholder="e.g. Business license"
                />
              </Field>
              <Field label="Qualification document URL">
                <input
                  className={inputClass}
                  type="url"
                  value={form.documentUrl}
                  onChange={(event) =>
                    update("documentUrl", event.target.value)
                  }
                  placeholder="https://..."
                />
              </Field>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="review-heading">
            <h2 id="review-heading" className="text-xl font-semibold">
              Review application
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Check the details below before submitting for administrator
              review.
            </p>
            <dl className="mt-6 grid gap-x-8 gap-y-5 rounded-xl bg-neutral-50 p-5 sm:grid-cols-2">
              <Review label="Company" value={form.companyName} />
              <Review label="Registration number" value={form.legalRegNo} />
              <Review label="Contact" value={form.contactName} />
              <Review label="Email" value={form.contactEmail} />
              <Review label="Phone" value={form.phone} />
              <Review label="Country or region" value={form.country} />
              <Review label="Business type" value={form.businessType} />
              <Review
                label="Qualification"
                value={
                  form.documentName ||
                  (form.documentUrl ? "Document link provided" : "Not provided")
                }
              />
            </dl>
            <label className="mt-6 flex items-start gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                  setError("");
                }}
                className="mt-0.5 h-4 w-4 accent-[#2B5F8A]"
              />
              <span>
                I confirm that the information is accurate and that I am
                authorized to apply for this business.
              </span>
            </label>
          </section>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-neutral-200 pt-6">
          <button
            type="button"
            onClick={() => {
              setStep((current) => Math.max(current - 1, 0));
              setError("");
            }}
            disabled={step === 0 || submitting}
            className="rounded-xl border border-neutral-300 px-5 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-xl bg-[#2B5F8A] px-5 py-2.5 font-semibold text-white hover:bg-[#204b70]"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#2B5F8A] px-5 py-2.5 font-semibold text-white hover:bg-[#204b70] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-800">
      {label}
      {required && (
        <span className="ml-1 text-red-600" aria-hidden="true">
          *
        </span>
      )}
      {children}
    </label>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function applicationErrorMessage(cause: unknown) {
  if (!(cause instanceof ApiError))
    return "The application could not be submitted. Please try again.";
  if (cause.status === 409)
    return "An application with these details already exists.";
  if (cause.status === 422 || cause.status === 400)
    return "Some application details are invalid. Please review and try again.";
  if (cause.status === 429)
    return "Too many attempts. Please wait a moment before trying again.";
  return (
    cause.message || "The application could not be submitted. Please try again."
  );
}

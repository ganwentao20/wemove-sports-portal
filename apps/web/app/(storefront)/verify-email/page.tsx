import type { Metadata } from "next";
import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Verify your email</h1>
      <p className="mt-2 text-sm text-neutral-600">Complete the one-time verification before signing in.</p>
      <VerifyEmailForm token={token} />
    </div>
  );
}

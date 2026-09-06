import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Reset your password</h1>
      <p className="mt-2 text-sm text-neutral-600">Enter your email and we will send instructions if an eligible account exists.</p>
      <ForgotPasswordForm />
    </div>
  );
}

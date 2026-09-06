import type { Metadata } from "next";
import { CustomerRegisterForm } from "./customer-register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Create account</h1>
      <p className="mt-1 text-sm text-neutral-500">
        For personal shopping and order tracking.
      </p>
      <CustomerRegisterForm />
      <p className="mt-4 text-center text-sm text-neutral-500">
        WEMOVE toys are for kids — accounts are for adults only.
      </p>
    </div>
  );
}

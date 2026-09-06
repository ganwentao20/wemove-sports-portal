import type { Metadata } from "next";
import { CustomerLoginForm } from "./customer-login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sign in to manage your account and shopping cart.
      </p>
      <CustomerLoginForm />
      <p className="mt-4 text-center text-sm text-neutral-500">
        New here?{" "}
        <a href="/customer/register" className="text-[var(--wm-primary)]">
          Create account
        </a>
      </p>
    </div>
  );
}

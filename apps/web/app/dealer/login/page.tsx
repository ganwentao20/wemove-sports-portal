import type { Metadata } from "next";
import { DealerLoginForm } from "./dealer-login-form";

export const metadata: Metadata = { title: "Dealer Sign in" };

/** 经销商登录（同一 User 体系 /api/v1/auth/login；企业边界由服务端 companyId 判定） */
export default function DealerLoginPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Dealer Portal</h1>
      <p className="mt-1 text-sm text-neutral-500">
        For approved wholesale partners only.
      </p>
      <DealerLoginForm />
      <p className="mt-4 text-center text-sm text-neutral-500">
        Not a dealer yet?{" "}
        <a href="/dealer/apply" className="text-[var(--wm-primary)]">
          Apply here
        </a>
      </p>
    </div>
  );
}

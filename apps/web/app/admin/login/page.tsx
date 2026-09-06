import type { Metadata } from "next";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = {
  title: "Admin Sign in",
  robots: { index: false, follow: false },
};

/** 后台员工登录（POST /api/v1/auth/staff/login）—— 与 C 端账号体系物理隔离 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wm-dark)] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8">
        <h1 className="text-2xl font-bold">WEMOVE Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Operations console — authorized staff only.
        </p>
        <AdminLoginForm />
        <p className="mt-4 text-center text-xs text-neutral-400">
          RBAC enforcement lives server-side (API guards)
        </p>
      </div>
    </div>
  );
}

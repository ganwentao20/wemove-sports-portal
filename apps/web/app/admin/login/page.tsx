import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin Sign in', robots: { index: false, follow: false } };

/** 后台员工登录（POST /api/v1/auth/staff/login）—— 与 C 端账号体系物理隔离 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wm-dark)] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8">
        <h1 className="text-2xl font-bold">WEMOVE Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">Operations console — authorized staff only.</p>
        <form className="mt-6 space-y-4">
          <input type="email" required placeholder="Staff email" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
          <input type="password" required placeholder="Password" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
          <button className="w-full rounded-full bg-[var(--wm-primary)] py-3 text-sm font-semibold text-white hover:opacity-90">
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-neutral-400">RBAC enforcement lives server-side (API guards)</p>
      </div>
    </div>
  );
}
